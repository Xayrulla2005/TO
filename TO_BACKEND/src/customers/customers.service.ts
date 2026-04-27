import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
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

  async findAll(search?: string): Promise<any[]> {
    let customers: CustomerEntity[];
    if (search) {
      customers = await this.repo.find({
        where: [{ name: ILike(`%${search}%`) }, { phone: ILike(`%${search}%`) }],
        order: { createdAt: 'DESC' },
      });
    } else {
      customers = await this.repo.find({ order: { createdAt: 'DESC' } });
    }
    if (customers.length === 0) return [];
    const ids = customers.map(c => c.id);
    const debtRows = await this.saleRepo
      .createQueryBuilder('sale')
      .innerJoin('sale.debt', 'debt')
      .select('sale.customerId', 'customerId')
      .addSelect('SUM(CAST(debt.remainingAmount AS numeric))', 'totalDebt')
      .addSelect('MIN(sale.createdAt)', 'oldestDebtAt')
      .where('sale.customerId IN (:...ids)', { ids })
      .andWhere("debt.status IN ('PENDING','PARTIALLY_PAID')")
      .groupBy('sale.customerId')
      .getRawMany();
    const debtMap = new Map<string, any>();
    for (const row of debtRows) {
      debtMap.set(row.customerId, { totalDebt: Number(row.totalDebt) || 0, oldestDebtAt: row.oldestDebtAt });
    }
    return customers.map(c => ({
      ...c,
      totalDebt: debtMap.get(c.id)?.totalDebt ?? 0,
      oldestDebtAt: debtMap.get(c.id)?.oldestDebtAt ?? null,
    }));
  }

  async findOne(id: string): Promise<CustomerEntity> {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');
    return customer;
  }

  async findByPhone(phone: string): Promise<CustomerEntity | null> {
    return this.repo.findOne({ where: { phone } });
  }

  async create(dto: CreateCustomerDto): Promise<CustomerEntity> {
    const existing = await this.findByPhone(dto.phone);
    if (existing) throw new ConflictException('Bu telefon raqam allaqachon mavjud');
    const customer = this.repo.create(dto);
    return this.repo.save(customer);
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerEntity> {
    const customer = await this.findOne(id);
    if (dto.phone && dto.phone !== customer.phone) {
      const existing = await this.findByPhone(dto.phone);
      if (existing) throw new ConflictException('Bu telefon raqam allaqachon mavjud');
    }
    Object.assign(customer, dto);
    return this.repo.save(customer);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const customer = await this.findOne(id);
    await this.repo.remove(customer);
    return { success: true };
  }

  async getSalesHistory(customerId: string, page = 1, limit = 20) {
    await this.findOne(customerId);
    const [data, total] = await this.saleRepo.findAndCount({
      where: { customerId, status: SaleStatus.COMPLETED },
      relations: ['items', 'payments', 'debt'],
      order: { completedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getStats(customerId: string) {
    await this.findOne(customerId);
    const sales = await this.saleRepo.find({
      where: { customerId, status: SaleStatus.COMPLETED },
      relations: ['debt'],
    });
    const totalSales = sales.length;
    const totalAmount = sales.reduce((s, sale) => s + Number(sale.grandTotal), 0);
    let totalDebt = 0;
    for (const sale of sales) {
      if (sale.debt && ['PENDING', 'PARTIALLY_PAID'].includes(sale.debt.status)) {
        totalDebt += Number(sale.debt.remainingAmount);
      }
    }
    const monthlyStats: Record<string, { count: number; amount: number }> = {};
    for (const sale of sales) {
      const date = sale.completedAt || sale.createdAt;
      const key = `${new Date(date).getFullYear()}-${String(new Date(date).getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[key]) monthlyStats[key] = { count: 0, amount: 0 };
      monthlyStats[key].count += 1;
      monthlyStats[key].amount += Number(sale.grandTotal);
    }
    return { totalSales, totalAmount, totalDebt, averageOrderValue: totalSales > 0 ? totalAmount / totalSales : 0, monthlyStats };
  }
}
