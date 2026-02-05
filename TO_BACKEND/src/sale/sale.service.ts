// ============================================================
// src/sales/sales.service.ts - PRODUCTION COMPLETE
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
import { DebtEntity, DebtStatus } from '../debts/entities/debt.entity'
import { InventoryTransactionEntity } from '../inventory/entities/inventory.entity'
import { InventoryTransactionType } from '../inventory/entities/inventory.entity'
import { CreateSaleDto, UpdateSaleDto, CompleteSaleDto, CancelSaleDto } from './dto/create-sale.dto';
import { UpdateSaleItemDto } from './dto/create-sale.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity as AuditEntityEnum } from '../audit-logs/entities/audit-log.entity';
import { UserRole } from '../common/dto/roles.enum';
import { SaleQueryDto } from './dto/sale.query.dto';

@Injectable()
export class SalesService {
  findById(saleId: string) {
    throw new Error('Method not implemented.');
  }
  cancelSale(saleId: string, dto: CancelSaleDto, id: string) {
    throw new Error('Method not implemented.');
  }
  updateSale(saleId: string, dto: UpdateSaleDto, id: string, role: UserRole) {
    throw new Error('Method not implemented.');
  }
  createSale(dto: CreateSaleDto, id: string) {
    throw new Error('Method not implemented.');
  }
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

  private async generateSaleNumber(): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    const count = await this.saleRepository
      .createQueryBuilder('sale')
      .where("sale.sale_number LIKE :pattern", { pattern: `SALE-${dateStr}-%` })
      .getCount();

    return `SALE-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateSaleDto, userId: string, userRole: UserRole): Promise<SaleEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const productIds = dto.items.map((i) => i.productId);
      const products = await queryRunner.manager.find(ProductEntity, {
        where: { id: In(productIds) },
        relations: ['category'],
      });

      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products not found');
      }

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
        const baseUnitPrice = Number(product.salePrice);
        const customUnitPrice = itemDto.customUnitPrice ?? baseUnitPrice;
        const purchasePriceSnapshot = Number(product.purchasePrice);
        const quantity = itemDto.quantity;

        if (userRole === UserRole.SALER && customUnitPrice < baseUnitPrice * 0.5) {
          throw new BadRequestException(`Custom price too low for ${product.name}`);
        }

        const baseTotal = baseUnitPrice * quantity;
        const customTotal = customUnitPrice * quantity;
        const discountAmount = itemDto.discountAmount ?? 0;
        const itemProfit = (customUnitPrice - purchasePriceSnapshot) * quantity;

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
        subtotal += customTotal;
        totalDiscount += discountAmount;
        grossProfit += itemProfit;
      }

      sale.subtotal = subtotal;
      sale.totalDiscount = totalDiscount;
      sale.grandTotal = subtotal - totalDiscount;
      sale.grossProfit = grossProfit;
      sale.netProfit = grossProfit - totalDiscount;
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

  async completeSale(saleId: string, dto: CompleteSaleDto, userId: string): Promise<SaleEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sale = await queryRunner.manager.findOne(SaleEntity, {
        where: { id: saleId },
        relations: ['items', 'items.product'],
      });

      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status !== SaleStatus.DRAFT) {
        throw new BadRequestException('Sale is not in DRAFT status');
      }

      const paymentTotal = dto.payments.reduce((sum, p) => sum + p.amount, 0);
      const grandTotal = Number(sale.grandTotal);

      if (Math.abs(paymentTotal - grandTotal) > 0.01) {
        throw new BadRequestException('Payment total must equal grand total');
      }

      const debtPayment = dto.payments.find((p) => p.method === PaymentMethod.DEBT);
      if (debtPayment && (!dto.debtorName || !dto.debtorPhone)) {
        throw new BadRequestException('Debtor info required for debt payment');
      }

      // Check and decrease inventory
      for (const item of sale.items) {
  if (!item.productId) {
    throw new BadRequestException('Sale item has no productId');
  }

  const product = await queryRunner.manager.findOne(ProductEntity, {
    where: { id: item.productId },
    lock: { mode: 'pessimistic_write' },
  });

        if (!product) throw new NotFoundException(`Product not found`);

        const currentStock = Number(product.stockQuantity);
        const required = Number(item.quantity);

        if (currentStock < required) {
          throw new BadRequestException(
            `Insufficient stock for ${item.productNameSnapshot}. Available: ${currentStock}`
          );
        }

        const stockBefore = currentStock;
        const stockAfter = currentStock - required;
        product.stockQuantity = stockAfter;
        await queryRunner.manager.save(product);

        const transaction = queryRunner.manager.create(InventoryTransactionEntity, {
          productId: product.id,
          type: InventoryTransactionType.SALE,
          quantity: -required,
          stockBefore,
          stockAfter,
          referenceId: sale.id,
          referenceType: 'sale',
          notes: `Sale ${sale.saleNumber}`,
        });
        await queryRunner.manager.save(transaction);
      }

      // Record payments
      for (const p of dto.payments) {
        const payment = queryRunner.manager.create(PaymentEntity, {
          saleId: sale.id,
          amount: p.amount,
          method: p.method,
          notes: p.notes,
        });
        await queryRunner.manager.save(payment);
      }

      // Create debt if applicable
      if (debtPayment) {
        const debt = queryRunner.manager.create(DebtEntity, {
          saleId: sale.id,
          debtorName: dto.debtorName!,
          debtorPhone: dto.debtorPhone!,
          originalAmount: debtPayment.amount,
          remainingAmount: debtPayment.amount,
          status: DebtStatus.PENDING,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.debtNotes,
        });
        await queryRunner.manager.save(debt);
      }

      sale.status = SaleStatus.COMPLETED;
      sale.completedAt = new Date();
      await queryRunner.manager.save(sale);

      await queryRunner.commitTransaction();

      await this.auditLogService.log({
        userId,
        action: AuditAction.SALE_COMPLETED,
        entity: AuditEntityEnum.SALE,
        entityId: sale.id,
        afterSnapshot: { status: SaleStatus.COMPLETED },
      });

      return this.findOne(sale.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(saleId: string, reason: string, userId: string): Promise<SaleEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sale = await queryRunner.manager.findOne(SaleEntity, {
        where: { id: saleId },
        relations: ['items'],
      });

      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status === SaleStatus.CANCELLED) {
        throw new BadRequestException('Sale already cancelled');
      }

      // Reverse inventory if completed
      if (sale.status === SaleStatus.COMPLETED) {
       for (const item of sale.items) {
  if (!item.productId) {
    throw new BadRequestException('Sale item has no productId');
  }

  const product = await queryRunner.manager.findOne(ProductEntity, {
    where: { id: item.productId },
    lock: { mode: 'pessimistic_write' },
  });

          if (product) {
            const stockBefore = Number(product.stockQuantity);
            const restore = Number(item.quantity);
            product.stockQuantity = stockBefore + restore;
            await queryRunner.manager.save(product);

            const transaction = queryRunner.manager.create(InventoryTransactionEntity, {
              productId: product.id,
              type: InventoryTransactionType.ADJUSTMENT,
              quantity: restore,
              stockBefore,
              stockAfter: stockBefore + restore,
              referenceId: sale.id,
              referenceType: 'sale_cancellation',
              notes: `Cancelled ${sale.saleNumber}`,
            });
            await queryRunner.manager.save(transaction);
          }
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

  async findAll(
  pagination: SaleQueryDto,
): Promise<PaginatedResponseDto<SaleEntity>> {

  const { page = 1, limit = 20, search, status } = pagination;

    const query = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.createdBy', 'user')
      .leftJoinAndSelect('sale.items', 'items')
      .orderBy('sale.created_at', 'DESC');

    if (search) {
      query.andWhere('sale.sale_number LIKE :search', { search: `%${search}%` });
    }

    if (status) {
      query.andWhere('sale.status = :status', { status });
    }

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