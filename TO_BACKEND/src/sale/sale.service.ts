// ============================================================
// src/sales/sales.service.ts
// ============================================================
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { SaleEntity, SaleStatus } from './entities/sale.entity';
import { SaleItemEntity } from './entities/sale.item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { PaymentEntity, PaymentMethod } from '../payments/entities/payment.entity';
import { DebtEntity, DebtStatus } from '../debts/entities/debt.entity';
import { InventoryTransactionEntity, InventoryTransactionType } from '../inventory/entities/inventory.entity';
import { CreateSaleDto, UpdateSaleDto, CompleteSaleDto, CancelSaleDto } from './dto/create-sale.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity as AuditEntityEnum } from '../audit-logs/entities/audit-log.entity';
import { UserRole } from '../common/dto/roles.enum';
import { SaleQueryDto } from './dto/sale.query.dto';
import { CustomerEntity } from '../customers/entities/customer.entity';

export interface DebtSummary {
  previousDebt: number;
  currentSaleDebt: number;
  totalDebtAfter: number;
}

export interface SaleWithDebtSummary extends SaleEntity {
  debtSummary: DebtSummary;
}

export interface CompletedSaleResult extends SaleEntity {
  debtSummary: DebtSummary;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(SaleEntity)
    private readonly saleRepository: Repository<SaleEntity>,
    @InjectRepository(SaleItemEntity)
    private readonly saleItemRepository: Repository<SaleItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(DebtEntity)
    private readonly debtRepository: Repository<DebtEntity>,
    @InjectRepository(InventoryTransactionEntity)
    private readonly inventoryTransactionRepository: Repository<InventoryTransactionEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createSale(dto: CreateSaleDto, userId: string): Promise<SaleEntity> {
    return this.create(dto, userId, UserRole.SALER);
  }

  async updateSale(
    saleId: string,
    dto: UpdateSaleDto,
    userId: string,
    role: UserRole,
  ): Promise<SaleEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const sale = await queryRunner.manager.findOne(SaleEntity, {
        where: { id: saleId },
        relations: ['items'],
      });
      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status !== SaleStatus.DRAFT)
        throw new BadRequestException('Can only update DRAFT sales');

      for (const itemDto of dto.items) {
        const item = await queryRunner.manager.findOne(SaleItemEntity, {
          where: { id: itemDto.itemId },
        });
        if (!item) throw new NotFoundException('Sale item not found');
        if (itemDto.customUnitPrice !== undefined) {
          item.customUnitPrice = itemDto.customUnitPrice;
          item.customTotal = parseFloat(
            (item.customUnitPrice * Number(item.quantity)).toFixed(4),
          );
        }
        if (itemDto.discountAmount !== undefined)
          item.discountAmount = itemDto.discountAmount;
        await queryRunner.manager.save(item);
      }

      const items = await queryRunner.manager.find(SaleItemEntity, {
        where: { saleId: sale.id },
      });
      sale.subtotal = parseFloat(
        items.reduce((sum, i) => sum + Number(i.customTotal), 0).toFixed(4),
      );
      sale.totalDiscount = parseFloat(
        items.reduce((sum, i) => sum + Number(i.discountAmount), 0).toFixed(4),
      );
      sale.grandTotal = parseFloat((sale.subtotal - sale.totalDiscount).toFixed(4));
      if (dto.notes !== undefined) sale.notes = dto.notes;
      await queryRunner.manager.save(sale);
      await queryRunner.commitTransaction();
      return this.findOne(sale.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelSale(
    saleId: string,
    dto: CancelSaleDto,
    userId: string,
  ): Promise<SaleEntity> {
    return this.cancel(saleId, dto.reason || 'No reason provided', userId);
  }

  async findById(saleId: string): Promise<SaleEntity> {
    return this.findOne(saleId);
  }

  private async generateSaleNumber(): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.saleRepository
      .createQueryBuilder('sale')
      .withDeleted()
      .where('"sale"."saleNumber" LIKE :pattern', { pattern: `SALE-${dateStr}-%` })
      .getCount();
    return `SALE-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(
    dto: CreateSaleDto,
    userId: string,
    userRole: UserRole,
  ): Promise<SaleEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const productIds = dto.items.map((i) => i.productId);
      const products = await queryRunner.manager.find(ProductEntity, {
        where: { id: In(productIds) },
        relations: ['category'],
      });
      if (products.length !== productIds.length)
        throw new NotFoundException('One or more products not found');

      const productMap = new Map(products.map((p) => [p.id, p]));
      const saleNumber = await this.generateSaleNumber();
      const sale = queryRunner.manager.create(SaleEntity, {
        saleNumber,
        status: SaleStatus.DRAFT,
        notes: dto.notes,
        createdById: userId,
      });
      await queryRunner.manager.save(sale);

      let subtotal = 0;
      let totalDiscount = 0;
      let grossProfit = 0;

      for (const itemDto of dto.items) {
        const product = productMap.get(itemDto.productId)!;
        const category = product.category?.name || 'Uncategorized';
        const baseUnitPrice = parseFloat(Number(product.salePrice).toFixed(4));
        const customUnitPrice = parseFloat(
          (itemDto.customUnitPrice ?? baseUnitPrice).toFixed(4),
        );
        const purchasePriceSnapshot = parseFloat(
          Number(product.purchasePrice).toFixed(4),
        );
        const quantity = parseFloat(Number(itemDto.quantity).toFixed(4));

        if (userRole === UserRole.SALER && customUnitPrice < baseUnitPrice * 0.5) {
          throw new BadRequestException(
            `Custom price too low for ${product.name}`,
          );
        }

        const baseTotal = parseFloat((baseUnitPrice * quantity).toFixed(4));
        const customTotal = parseFloat((customUnitPrice * quantity).toFixed(4));
        const discountAmount = parseFloat(
          (itemDto.discountAmount ?? 0).toFixed(4),
        );
        const itemProfit = parseFloat(
          ((customUnitPrice - purchasePriceSnapshot) * quantity).toFixed(4),
        );

        const item = queryRunner.manager.create(SaleItemEntity, {
          saleId: sale.id,
          productId: product.id,
          productNameSnapshot: product.name,
          categorySnapshot: category,
          baseUnitPrice,
          customUnitPrice,
          purchasePriceSnapshot,
          quantity,
          unitSnapshot: product.unit,
          baseTotal,
          customTotal,
          discountAmount,
        });
        await queryRunner.manager.save(item);

        subtotal = parseFloat((subtotal + customTotal).toFixed(4));
        totalDiscount = parseFloat((totalDiscount + discountAmount).toFixed(4));
        grossProfit = parseFloat((grossProfit + itemProfit).toFixed(4));
      }

      sale.subtotal = subtotal;
      sale.totalDiscount = totalDiscount;
      sale.grandTotal = parseFloat((subtotal - totalDiscount).toFixed(4));
      sale.grossProfit = grossProfit;
      sale.netProfit = parseFloat((grossProfit - totalDiscount).toFixed(4));
      await queryRunner.manager.save(sale);
      await queryRunner.commitTransaction();

      await this.auditLogService.log({
        userId,
        action: AuditAction.SALE_CREATED,
        entity: AuditEntityEnum.SALE,
        entityId: sale.id,
        afterSnapshot: { saleNumber, status: SaleStatus.DRAFT },
      });

      return this.findOne(sale.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async completeSale(
    saleId: string,
    dto: CompleteSaleDto,
    userId: string,
  ): Promise<CompletedSaleResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sale = await queryRunner.manager.findOne(SaleEntity, {
        where: { id: saleId },
        relations: ['items'],
      });

      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status !== SaleStatus.DRAFT)
        throw new BadRequestException('Sale is not in DRAFT status');

      const storedGrandTotal = parseFloat(Number(sale.grandTotal).toFixed(4));
      const effectiveGrandTotal =
        dto.agreedTotal != null &&
        !isNaN(dto.agreedTotal) &&
        Math.abs(dto.agreedTotal - storedGrandTotal) > 0.001
          ? parseFloat(Number(dto.agreedTotal).toFixed(4))
          : storedGrandTotal;

      const paymentTotal = parseFloat(
        dto.payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(4),
      );

      if (Math.abs(paymentTotal - effectiveGrandTotal) > 0.01) {
        throw new BadRequestException(
          `Payment total (${paymentTotal}) must equal grand total (${effectiveGrandTotal})`,
        );
      }

      const debtPayment = dto.payments.find(
        (p) => p.method === PaymentMethod.DEBT,
      );
      const resolvedCustomerName = dto.customerName || dto.debtorName;
      const resolvedCustomerPhone = dto.customerPhone || dto.debtorPhone;

      if (debtPayment && (!resolvedCustomerName || !resolvedCustomerPhone)) {
        throw new BadRequestException('Debtor info required for debt payment');
      }

      // ── Inventory ──────────────────────────────────────────
      for (const item of sale.items) {
        if (!item.productId)
          throw new BadRequestException('Sale item has no productId');

        const product = await queryRunner.manager
          .createQueryBuilder(ProductEntity, 'product')
          .where('product.id = :id', { id: item.productId })
          .setLock('pessimistic_write')
          .getOne();

        if (!product)
          throw new NotFoundException(`Product ${item.productNameSnapshot} not found`);

        const currentStock = parseFloat(Number(product.stockQuantity).toFixed(4));
        const required = parseFloat(Number(item.quantity).toFixed(4));

        if (currentStock < required) {
          throw new BadRequestException(
            `${item.productNameSnapshot} uchun yetarli qoldiq yo'q. Mavjud: ${currentStock}, Kerak: ${required}`,
          );
        }

        const newStock = parseFloat((currentStock - required).toFixed(4));

        await queryRunner.query(
          `UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [newStock, product.id],
        );

        const transaction = queryRunner.manager.create(InventoryTransactionEntity, {
          productId: product.id,
          type: InventoryTransactionType.SALE,
          quantity: -required,
          stockBefore: currentStock,
          stockAfter: newStock,
          referenceId: sale.id,
          referenceType: 'sale',
          notes: `Sale ${sale.saleNumber}`,
        });
        await queryRunner.manager.save(transaction);
      }

      // ── Payments ────────────────────────────────────────────
      for (const p of dto.payments) {
        const payment = queryRunner.manager.create(PaymentEntity, {
          saleId: sale.id,
          amount: parseFloat(Number(p.amount).toFixed(4)),
          method: p.method,
          notes: p.notes || null,
        });
        await queryRunner.manager.save(PaymentEntity, payment);
      }

      // ── Customer resolve ────────────────────────────────────
      let customerId: string | null = null;
      let customer: CustomerEntity | null = null;

      if (dto.customerId) {
        customer = await queryRunner.manager.findOne(CustomerEntity, {
          where: { id: dto.customerId },
          lock: { mode: 'pessimistic_write' },
        });
        if (customer) customerId = customer.id;
      } else if (resolvedCustomerName && resolvedCustomerPhone) {
        customer = await queryRunner.manager.findOne(CustomerEntity, {
          where: { phone: resolvedCustomerPhone },
          lock: { mode: 'pessimistic_write' },
        });

        if (!customer) {
          customer = queryRunner.manager.create(CustomerEntity, {
            name: resolvedCustomerName,
            phone: resolvedCustomerPhone,
            totalDebt: 0,
          });
          customer = await queryRunner.manager.save(CustomerEntity, customer);
        } else if (customer.name !== resolvedCustomerName) {
          customer.name = resolvedCustomerName;
          customer = await queryRunner.manager.save(CustomerEntity, customer);
        }
        customerId = customer.id;
      }

      // ── Debt summary — capture previousDebt BEFORE updating ─
      const previousDebt = customer
        ? parseFloat(Number(0 || 0).toFixed(4))
        : 0;
      const currentSaleDebt = debtPayment
        ? parseFloat(Number(debtPayment.amount).toFixed(4))
        : 0;
      const totalDebtAfter = parseFloat((previousDebt + currentSaleDebt).toFixed(4));

      // ── Update 0 ───────────────────────────
      if (customer && debtPayment) {
        await queryRunner.query(
          `UPDATE customers SET total_debt = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [totalDebtAfter, customer.id],
        );
      }

      // ── Debt entity ─────────────────────────────────────────
      if (debtPayment) {
        const debt = queryRunner.manager.create(DebtEntity, {
          saleId: sale.id,
          debtorName: resolvedCustomerName!,
          debtorPhone: resolvedCustomerPhone!,
          originalAmount: currentSaleDebt,
          remainingAmount: currentSaleDebt,
          status: DebtStatus.PENDING,
          notes: dto.debtNotes,
        });
        await queryRunner.manager.save(debt);
      }

      // ── Update grandTotal if agreedTotal differs ────────────
      if (Math.abs(effectiveGrandTotal - storedGrandTotal) > 0.001) {
        const discountFromAgreed = parseFloat(
          (storedGrandTotal - effectiveGrandTotal).toFixed(4),
        );
        await queryRunner.manager
          .createQueryBuilder()
          .update(SaleEntity)
          .set({
            grandTotal: effectiveGrandTotal,
            totalDiscount: parseFloat(
              (Number(sale.totalDiscount) + discountFromAgreed).toFixed(4),
            ),
          })
          .where('id = :id', { id: sale.id })
          .execute();
      }

      // ── Finalize sale status ────────────────────────────────
      await queryRunner.manager
        .createQueryBuilder()
        .update(SaleEntity)
        .set({
          status: SaleStatus.COMPLETED,
          completedAt: new Date(),
          customerId: customerId,
        })
        .where('id = :id', { id: sale.id })
        .execute();

      await queryRunner.commitTransaction();

      await this.auditLogService.log({
        userId,
        action: AuditAction.SALE_COMPLETED,
        entity: AuditEntityEnum.SALE,
        entityId: sale.id,
        afterSnapshot: {
          status: SaleStatus.COMPLETED,
          saleNumber: sale.saleNumber,
          grandTotal: effectiveGrandTotal,
          customerId: customerId || null,
          customerName: resolvedCustomerName || null,
          customerPhone: resolvedCustomerPhone || null,
          previousDebt,
          currentSaleDebt,
          totalDebtAfter,
        },
      });

      const freshSale = await this.findOne(sale.id);
      const result = freshSale as CompletedSaleResult;
      result.debtSummary = { previousDebt, currentSaleDebt, totalDebtAfter };
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(
    saleId: string,
    reason: string,
    userId: string,
  ): Promise<SaleEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const sale = await queryRunner.manager.findOne(SaleEntity, {
        where: { id: saleId },
        relations: ['items', 'payments', 'customer'],
      });
      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status === SaleStatus.CANCELLED)
        throw new BadRequestException('Sale already cancelled');

      if (sale.status === SaleStatus.COMPLETED) {
        for (const item of sale.items) {
          if (!item.productId)
            throw new BadRequestException('Sale item has no productId');
          const product = await queryRunner.manager.findOne(ProductEntity, {
            where: { id: item.productId },
            lock: { mode: 'pessimistic_write' },
          });
          if (product) {
            const stockBefore = parseFloat(Number(product.stockQuantity).toFixed(4));
            const restore = parseFloat(Number(item.quantity).toFixed(4));
            const stockAfter = parseFloat((stockBefore + restore).toFixed(4));

            await queryRunner.query(
              `UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
              [stockAfter, product.id],
            );

            const transaction = queryRunner.manager.create(InventoryTransactionEntity, {
              productId: product.id,
              type: InventoryTransactionType.ADJUSTMENT,
              quantity: restore,
              stockBefore,
              stockAfter,
              referenceId: sale.id,
              referenceType: 'sale_cancellation',
              notes: `Cancelled ${sale.saleNumber}`,
            });
            await queryRunner.manager.save(transaction);
          }
        }

        const debtPayment = sale.payments?.find(
          (p) => p.method === PaymentMethod.DEBT,
        );
        if (debtPayment && sale.customerId) {
          const currentDebt = parseFloat(Number(0 || 0).toFixed(4));
          const newDebt = parseFloat(
            Math.max(0, currentDebt - parseFloat(Number(debtPayment.amount).toFixed(4))).toFixed(4),
          );
          await queryRunner.query(
            `UPDATE customers SET total_debt = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [newDebt, sale.customerId],
          );
        }
      }

      sale.status = SaleStatus.CANCELLED;
      sale.cancelledAt = new Date();
      sale.cancellationReason = reason;
      await queryRunner.manager.save(sale);
      await queryRunner.commitTransaction();

      await this.auditLogService.log({
        userId,
        action: AuditAction.SALE_CANCELLED,
        entity: AuditEntityEnum.SALE,
        entityId: sale.id,
        afterSnapshot: { status: SaleStatus.CANCELLED, reason },
      });

      return this.findOne(sale.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ── getSaleWithDebtSummary ──────────────────────────────────
  // Used by the receipt endpoint. Recomputes debtSummary from
  // persisted payment and customer data so the receipt always
  // shows correct values even when called long after the sale
  // was completed (i.e. debtSummary was not stored in memory).
  async getSaleWithDebtSummary(saleId: string): Promise<SaleWithDebtSummary> {
    const sale = await this.findOne(saleId);

    const debtPayment = sale.payments?.find(
      (p) => p.method === PaymentMethod.DEBT,
    );

    // currentSaleDebt — the DEBT payment amount recorded for this sale
    const currentSaleDebt = debtPayment
      ? parseFloat(Number(debtPayment.amount).toFixed(4))
      : 0;

    // totalDebtAfter — customer's current total debt (already updated by completeSale)
    const customer = (sale as any).customer as CustomerEntity | null | undefined;
    const totalDebtAfter = customer
      ? parseFloat(Number(0 || 0).toFixed(4))
      : currentSaleDebt > 0 && sale.debt
        ? parseFloat(Number(sale.debt.remainingAmount || 0).toFixed(4))
        : 0;

    // previousDebt — what the customer owed BEFORE this sale.
    // = totalDebtAfter − currentSaleDebt
    // This is mathematically consistent with completeSale logic:
    //   totalDebtAfter = previousDebt + currentSaleDebt
    const previousDebt = parseFloat(
      Math.max(0, totalDebtAfter - currentSaleDebt).toFixed(4),
    );

    const result = sale as SaleWithDebtSummary;
    result.debtSummary = { previousDebt, currentSaleDebt, totalDebtAfter };
    return result;
  }

  async findAll(
    pagination: SaleQueryDto,
  ): Promise<PaginatedResponseDto<SaleEntity>> {
    const { page = 1, limit = 20, search, status } = pagination;
    const query = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.createdBy', 'user')
      .leftJoinAndSelect('sale.items', 'items')
      .orderBy('sale.created_at', 'DESC');

    if (search)
      query.andWhere('sale.sale_number LIKE :search', { search: `%${search}%` });
    if (status) query.andWhere('sale.status = :status', { status });

    const [sales, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return PaginatedResponseDto.create(sales, total, page, limit);
  }

  async findOne(id: string): Promise<SaleEntity> {
    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: ['createdBy', 'items', 'items.product', 'payments', 'debt'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }
}