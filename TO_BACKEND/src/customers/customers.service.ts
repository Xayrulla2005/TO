// TO_BACKEND/src/customers/customers.service.ts
// Tuzatishlar:
// 1. getStats() — sale.grand_total → sale."grandTotal" (DB column nomi)
// 2. getSalesHistory() — 'debt.payments' relation olib tashlandi (DebtEntity da yo'q)
// 3. getStats() monthly — ham xuddi shu fix

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerEntity } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SaleEntity, SaleStatus } from '../sale/entities/sale.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly repo: Repository<CustomerEntity>,
    @InjectRepository(SaleEntity)
    private readonly saleRepo: Repository<SaleEntity>,
  ) {}

  // ─── Barcha mijozlar ──────────────────────────────────────
  async findAll(search?: string, page = 1, limit = 50): Promise<any> {
    const safeLimit = Math.min(limit, 9999);
    const safePage  = Math.max(page, 1);

    const query = this.repo
      .createQueryBuilder('c')
      .orderBy('c.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    if (search?.trim()) {
      query.where(
        'c.name ILIKE :search OR c.phone ILIKE :search',
        { search: `%${search.trim()}%` },
      );
    }

    const [customers, total] = await query.getManyAndCount();

    if (customers.length === 0) {
      return { data: [], total, page: safePage, limit: safeLimit };
    }

    const ids = customers.map(c => c.id);

    const debtRows = await this.saleRepo
      .createQueryBuilder('sale')
      .innerJoin('sale.debt', 'debt')
      .select('sale.customer_id', 'customerId')
      .addSelect('SUM(debt.remaining_amount)::NUMERIC', 'totalDebt')
      .addSelect('MIN(sale.completed_at)', 'oldestDebtAt')
      .where('sale.customer_id IN (:...ids)', { ids })
      .andWhere("debt.status IN ('PENDING', 'PARTIALLY_PAID')")
      .groupBy('sale.customer_id')
      .getRawMany();

    const debtMap = new Map<string, { totalDebt: number; oldestDebtAt: string | null }>(
      debtRows.map(r => [
        r.customerId,
        {
          totalDebt:    Number(r.totalDebt)  || 0,
          oldestDebtAt: r.oldestDebtAt       || null,
        },
      ]),
    );

    const data = customers.map(c => {
      const debt = debtMap.get(c.id);
      return {
        ...c,
        totalDebt:    debt?.totalDebt    ?? 0,
        oldestDebtAt: debt?.oldestDebtAt ?? null,
      };
    });

    return { data, total, page: safePage, limit: safeLimit };
  }

  // ─── Bitta mijoz statistikasi ─────────────────────────────
  async getStats(customerId: string) {
    // ✅ FIX: sale.grand_total → sale."grandTotal"
    // TypeORM column nomi name: ko'rsatilmagan bo'lsa camelCase saqlanadi
    const stats = await this.saleRepo
      .createQueryBuilder('sale')
      .leftJoin('sale.debt', 'debt')
      .select('COUNT(sale.id)', 'totalSales')
      .addSelect('COALESCE(SUM(sale."grandTotal"), 0)::NUMERIC', 'totalAmount')
      .addSelect(
        `COALESCE(SUM(CASE WHEN debt.status IN ('PENDING', 'PARTIALLY_PAID') THEN debt.remaining_amount ELSE 0 END), 0)::NUMERIC`,
        'totalDebt',
      )
      .where('sale.customer_id = :customerId', { customerId })
      .andWhere('sale.status = :status', { status: SaleStatus.COMPLETED })
      .getRawOne();

    // ✅ FIX: oylik ham "grandTotal" bilan
    const monthlyRaw = await this.saleRepo
      .createQueryBuilder('sale')
      .select(
        "TO_CHAR(COALESCE(sale.completed_at, sale.created_at), 'YYYY-MM')",
        'month',
      )
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('COALESCE(SUM(sale."grandTotal"), 0)::NUMERIC', 'amount')
      .where('sale.customer_id = :customerId', { customerId })
      .andWhere('sale.status = :status', { status: SaleStatus.COMPLETED })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    const monthlyStats: Record<string, { count: number; amount: number }> = {};
    monthlyRaw.forEach(row => {
      monthlyStats[row.month] = {
        count:  Number(row.count)  || 0,
        amount: Number(row.amount) || 0,
      };
    });

    const totalSales  = Number(stats?.totalSales)  || 0;
    const totalAmount = Number(stats?.totalAmount)  || 0;
    const totalDebt   = Number(stats?.totalDebt)    || 0;

    return {
      totalSales,
      totalAmount,
      totalDebt,
      averageOrderValue: totalSales > 0 ? totalAmount / totalSales : 0,
      monthlyStats,
    };
  }

  // ─── Bitta mijoz ──────────────────────────────────────────
  async findOne(id: string): Promise<CustomerEntity> {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');
    return customer;
  }

  async getOne(id: string): Promise<CustomerEntity> {
    return this.findOne(id);
  }

  // ─── Yangi mijoz ──────────────────────────────────────────
  async create(dto: CreateCustomerDto): Promise<CustomerEntity> {
    const existing = await this.repo.findOne({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('Bu telefon raqam allaqachon mavjud');
    return this.repo.save(this.repo.create(dto));
  }

  // ─── Tahrirlash ───────────────────────────────────────────
  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerEntity> {
    const customer = await this.findOne(id);
    if (dto.phone && dto.phone !== customer.phone) {
      const existing = await this.repo.findOne({ where: { phone: dto.phone } });
      if (existing) throw new ConflictException('Bu telefon raqam band');
    }
    return this.repo.save(this.repo.merge(customer, dto));
  }

  // ─── O'chirish ────────────────────────────────────────────
  async remove(id: string): Promise<{ success: boolean }> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Mijoz topilmadi');
    return { success: true };
  }

  // ─── Savdo tarixi ─────────────────────────────────────────
  async getSalesHistory(customerId: string, page = 1, limit = 20) {
    const safeLimit = Math.min(limit, 9999);
    const safePage  = Math.max(page, 1);

    // ✅ FIX: 'debt.payments' olib tashlandi — DebtEntity da payments relation yo'q
    // Faqat mavjud relationlar: items, payments (SaleEntity.payments), debt
    const [data, total] = await this.saleRepo.findAndCount({
      where:     { customerId, status: SaleStatus.COMPLETED },
      relations: ['items', 'payments', 'debt'],
      order:     { completedAt: 'DESC' },
      skip:      (safePage - 1) * safeLimit,
      take:      safeLimit,
    });

    return { data, total, page: safePage, limit: safeLimit };
  }
}