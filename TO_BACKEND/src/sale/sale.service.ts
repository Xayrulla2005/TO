// TO_BACKEND/src/sale/sale.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, EntityManager } from 'typeorm';
import { SaleEntity, SaleStatus } from './entities/sale.entity';
import { SaleItemEntity } from './entities/sale.item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { PaymentEntity, PaymentMethod } from '../payments/entities/payment.entity';
import { DebtEntity, DebtStatus } from '../debts/entities/debt.entity';
import { InventoryTransactionEntity, InventoryTransactionType } from '../inventory/entities/inventory.entity';
import { CreateSaleDto, CompleteSaleDto, CancelSaleDto, UpdateSaleDto } from './dto/create-sale.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { UserRole } from '../common/dto/roles.enum';
import { SaleQueryDto } from './dto/sale.query.dto';
import { CustomerEntity } from '../customers/entities/customer.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(SaleEntity)
    private readonly saleRepository: Repository<SaleEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── UTILS ────────────────────────────────────────────────
  private round(val: number | string): number {
    return Math.round(Number(val || 0) * 100) / 100;
  }

  // ─── READ ─────────────────────────────────────────────────
  async findOne(id: string): Promise<SaleEntity> {
    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: ['createdBy', 'items', 'items.product', 'payments', 'debt', 'customer'],
    });
    if (!sale) throw new NotFoundException(`Sale #${id} topilmadi`);
    return sale;
  }

  async findAll(queryDto: SaleQueryDto): Promise<PaginatedResponseDto<SaleEntity>> {
    const { page = 1, limit = 20, search, status } = queryDto;
    const query = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.createdBy', 'user')
      .leftJoinAndSelect('sale.customer', 'customer')
      .orderBy('sale.createdAt', 'DESC');

    if (search) {
      query.andWhere('sale.saleNumber ILIKE :search', { search: `%${search}%` });
    }
    if (status) {
      query.andWhere('sale.status = :status', { status });
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return PaginatedResponseDto.create(data, total, page, limit);
  }

  // ─── CREATE (DRAFT) ───────────────────────────────────────
  async create(dto: CreateSaleDto, userId: string, userRole: UserRole): Promise<SaleEntity> {
    return await this.dataSource.transaction(async (manager) => {
      const products = await manager.find(ProductEntity, {
        where: { id: In(dto.items.map((i) => i.productId)) },
        relations: ['category'],
      });

      if (products.length !== dto.items.length) {
        throw new BadRequestException("Ba'zi mahsulotlar bazadan topilmadi");
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      const sale = manager.create(SaleEntity, {
        saleNumber:  await this.generateSaleNumber(manager),
        status:      SaleStatus.DRAFT,
        notes:       dto.notes,
        createdById: userId,
      });
      const savedSale = await manager.save(sale);

      let subtotal      = 0;
      let totalDiscount = 0;
      let grossProfit   = 0;

      for (const itemDto of dto.items) {
        const product     = productMap.get(itemDto.productId)!;
        const qty         = Number(itemDto.quantity);
        const basePrice   = Number(product.salePrice);
        const customPrice = Number(itemDto.customUnitPrice ?? basePrice);

        if (userRole === UserRole.SALER && customPrice < basePrice * 0.7) {
          throw new BadRequestException(`${product.name} uchun narx juda past`);
        }

        const itemSubtotal = this.round(customPrice * qty);
        const itemDiscount = this.round(itemDto.discountAmount ?? 0);
        const purchaseCost = this.round(Number(product.purchasePrice) * qty);

        const saleItem = manager.create(SaleItemEntity, {
          saleId:                savedSale.id,
          productId:             product.id,
          productNameSnapshot:   product.name,
          categorySnapshot:      product.category?.name || 'Uncategorized',
          baseUnitPrice:         basePrice,
          customUnitPrice:       customPrice,
          purchasePriceSnapshot: Number(product.purchasePrice),
          quantity:              qty,
          unitSnapshot:          product.unit || 'dona',
          baseTotal:             this.round(basePrice * qty),
          customTotal:           itemSubtotal,
          discountAmount:        itemDiscount,
        });

        await manager.save(saleItem);

        subtotal      += itemSubtotal;
        totalDiscount += itemDiscount;
        grossProfit   += itemSubtotal - purchaseCost;
      }

      savedSale.subtotal      = this.round(subtotal);
      savedSale.totalDiscount = this.round(totalDiscount);
      savedSale.grandTotal    = this.round(subtotal - totalDiscount);
      savedSale.grossProfit   = this.round(grossProfit);
      savedSale.netProfit     = this.round(grossProfit - totalDiscount);

      return await manager.save(savedSale);
    });
  }

  // ─── UPDATE (DRAFT only) ──────────────────────────────────
  async update(
    saleId: string,
    dto: UpdateSaleDto,
    userId: string,
  ): Promise<SaleEntity> {
    return await this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(SaleEntity, {
        where: { id: saleId },
        relations: ['items'],
      });

      if (!sale) {
        throw new NotFoundException(`Sotuv #${saleId} topilmadi`);
      }
      if (sale.status !== SaleStatus.DRAFT) {
        throw new BadRequestException('Faqat DRAFT holatidagi sotuvni tahrirlash mumkin');
      }
      if (dto.notes !== undefined) {
        sale.notes = dto.notes;
      }
      return manager.save(sale);
    });
  }

  // ─── COMPLETE ─────────────────────────────────────────────
  async completeSale(saleId: string, dto: CompleteSaleDto, userId: string): Promise<any> {
    return await this.dataSource.transaction(async (manager) => {

      // 1. Sotuvni lock bilan yuklaymiz
      const sale = await manager.findOne(SaleEntity, {
        where: { id: saleId },
        lock:  { mode: 'pessimistic_write' },
      });

      if (!sale || sale.status !== SaleStatus.DRAFT) {
        throw new BadRequestException('Sotuv topilmadi yoki allaqachon yakunlangan');
      }

      // 2. Items
      sale.items = await manager.find(SaleItemEntity, {
        where: { sale: { id: sale.id } },
      });
      if (!sale.items || sale.items.length === 0) {
        throw new BadRequestException('Sotuvda mahsulotlar mavjud emas');
      }

      // 3. To'lov tekshiruv
      const finalGrandTotal =
        dto.agreedTotal != null
          ? this.round(dto.agreedTotal)
          : Number(sale.grandTotal);

      const totalPaid = dto.payments.reduce((sum, p) => sum + Number(p.amount), 0);

      if (Math.abs(totalPaid - finalGrandTotal) > 0.01) {
        throw new BadRequestException(
          `To'lov miqdori (${totalPaid}) jami summaga (${finalGrandTotal}) mos emas`,
        );
      }

      // 4. Mahsulotlarni lock qilamiz (deadlock oldini olish)
      const sortedIds = [...new Set(sale.items.map((i) => i.productId))].sort();
      const products  = await manager.find(ProductEntity, {
        where:              { id: In(sortedIds) },
        loadEagerRelations: false,
        lock:               { mode: 'pessimistic_write' },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      // 5. Ombor tekshiruv va yangilash
      for (const item of sale.items) {
        const product = productMap.get(item.productId!);
        if (!product) {
          throw new BadRequestException(`Mahsulot topilmadi: ${item.productNameSnapshot}`);
        }
        if (Number(product.stockQuantity) < Number(item.quantity)) {
          throw new BadRequestException(
            `Omborda yetarli mahsulot yo'q: ${item.productNameSnapshot} ` +
            `(kerak: ${item.quantity}, mavjud: ${product.stockQuantity})`,
          );
        }

        const oldStock = Number(product.stockQuantity);
        const newStock = this.round(oldStock - Number(item.quantity));

        await manager.update(ProductEntity, product.id, { stockQuantity: newStock });
        await manager.save(InventoryTransactionEntity, {
          productId:     product.id,
          type:          InventoryTransactionType.SALE,
          quantity:      -Number(item.quantity),
          stockBefore:   oldStock,
          stockAfter:    newStock,
          referenceId:   sale.id,
          referenceType: 'sale',
        });
      }

      // 6. Mijoz va qarz
      const customer      = await this.resolveCustomer(manager, dto);
      let currentSaleDebt = 0;
      let previousDebt    = 0;

      if (customer) {
        previousDebt = this.round(Number(customer.totalDebt));

        const debtPayment = dto.payments.find((p) => p.method === PaymentMethod.DEBT);
        if (debtPayment) {
          currentSaleDebt = this.round(debtPayment.amount);

          await manager.increment(CustomerEntity, { id: customer.id }, 'totalDebt', currentSaleDebt);

          // ✅ debtorPhone — mijozdan olinadi, yo'q bo'lsa bo'sh string
          await manager.save(DebtEntity, {
            saleId:          sale.id,
            customerId:      customer.id,
            debtorName:      customer.name,
            debtorPhone:     customer.phone ?? dto.customerPhone ?? dto.debtorPhone ?? '',
            originalAmount:  currentSaleDebt,
            remainingAmount: currentSaleDebt,
            status:          DebtStatus.PENDING,
          });
        }
      }

      // 7. To'lovlarni saqlash
      for (const p of dto.payments) {
        await manager.save(PaymentEntity, {
          saleId: sale.id,
          amount: this.round(p.amount),
          method: p.method,
          notes:  p.notes,
        });
      }

      // 8. Sotuvni yangilash
      const extraDiscount = this.round(Number(sale.grandTotal) - finalGrandTotal);
      Object.assign(sale, {
        status:        SaleStatus.COMPLETED,
        completedAt:   new Date(),
        customerId:    customer?.id ?? null,
        grandTotal:    finalGrandTotal,
        totalDiscount: this.round(Number(sale.totalDiscount) + extraDiscount),
        netProfit:     this.round(Number(sale.netProfit) - extraDiscount),
      });

      const savedSale = await manager.save(sale);

      // 9. ✅ debtSummary qaytariladi
      return {
        ...savedSale,
        debtSummary: currentSaleDebt > 0
          ? {
              previousDebt,
              currentSaleDebt,
              totalDebtAfter: this.round(previousDebt + currentSaleDebt),
            }
          : null,
      };
    });
  }

  // ─── CANCEL ───────────────────────────────────────────────
  async cancel(id: string, dto: CancelSaleDto): Promise<SaleEntity> {
    return await this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(SaleEntity, {
        where:     { id },
        relations: ['items', 'payments', 'customer'],
      });

      if (!sale || sale.status === SaleStatus.CANCELLED) {
        throw new BadRequestException("Sotuv topilmadi yoki bekor qilib bo'lmaydi");
      }

      if (sale.status === SaleStatus.COMPLETED) {
        for (const item of sale.items) {
          await manager.increment(ProductEntity, { id: item.productId }, 'stockQuantity', item.quantity);
        }
        const debtPay = sale.payments.find((p) => p.method === PaymentMethod.DEBT);
        if (debtPay && sale.customerId) {
          await manager.decrement(CustomerEntity, { id: sale.customerId }, 'totalDebt', debtPay.amount);
        }
      }

      sale.status             = SaleStatus.CANCELLED;
      sale.cancelledAt        = new Date();
      sale.cancellationReason = dto.reason;

      return await manager.save(sale);
    });
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────
  private async resolveCustomer(
    manager: EntityManager,
    dto: CompleteSaleDto,
  ): Promise<CustomerEntity | null> {
    if (dto.customerId) {
      return manager.findOne(CustomerEntity, { where: { id: dto.customerId } });
    }

    const phone = dto.customerPhone || dto.debtorPhone;
    if (!phone) return null;

    let customer = await manager.findOne(CustomerEntity, { where: { phone } });
    if (!customer) {
      customer = manager.create(CustomerEntity, {
        phone,
        name:      dto.customerName || dto.debtorName || "Noma'lum",
        totalDebt: 0,
      });
      customer = await manager.save(customer);
    }
    return customer;
  }

  private async generateSaleNumber(manager: EntityManager): Promise<string> {
    const today    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const lastSale = await manager
      .createQueryBuilder(SaleEntity, 'sale')
      .where('sale.saleNumber LIKE :pattern', { pattern: `SALE-${today}-%` })
      .orderBy('sale.saleNumber', 'DESC')
      .setLock('pessimistic_write')
      .getOne();

    let seq = 1;
    if (lastSale) {
      const parts = lastSale.saleNumber.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }
    return `SALE-${today}-${String(seq).padStart(4, '0')}`;
  }
}