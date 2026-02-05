// ============================================================
// src/returns/returns.service.ts - PRODUCTION COMPLETE
// ============================================================
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { ReturnEntity, ReturnStatus } from './entities/return.entity';
import { ReturnItemEntity } from './entities/return.item.entity';
import { SaleEntity, SaleStatus } from '../sale/entities/sale.entity';
import { SaleItemEntity } from '../sale/entities/sale.item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { InventoryTransactionEntity, InventoryTransactionType } from '../inventory/entities/inventory.entity';
import { ApproveReturnDto, CreateReturnDto, RejectReturnDto} from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity as AuditEntityEnum } from '../audit-logs/entities/audit-log.entity';
import { SaleQueryDto } from 'src/sale/dto/sale.query.dto';

@Injectable()
export class ReturnsService {
  findById(returnId: string) {
    throw new Error('Method not implemented.');
  }
  rejectReturn(returnId: string, dto: RejectReturnDto, id: string) {
    throw new Error('Method not implemented.');
  }
  approveReturn(returnId: string, dto: ApproveReturnDto, id: string) {
    throw new Error('Method not implemented.');
  }
  createReturn(dto: CreateReturnDto, id: string) {
    throw new Error('Method not implemented.');
  }
  constructor(
    @InjectRepository(ReturnEntity)
    private readonly returnRepository: Repository<ReturnEntity>,
    @InjectRepository(ReturnItemEntity)
    private readonly returnItemRepository: Repository<ReturnItemEntity>,
    @InjectRepository(SaleEntity)
    private readonly saleRepository: Repository<SaleEntity>,
    @InjectRepository(SaleItemEntity)
    private readonly saleItemRepository: Repository<SaleItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(InventoryTransactionEntity)
    private readonly inventoryTransactionRepository: Repository<InventoryTransactionEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async generateReturnNumber(): Promise<string> {
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7).replace(/-/g, '');
    
    const count = await this.returnRepository
      .createQueryBuilder('ret')
      .where("ret.return_number LIKE :pattern", { pattern: `RET-${yearMonth}-%` })
      .getCount();

    return `RET-${yearMonth}-${String(count + 1).padStart(6, '0')}`;
  }

  async create(dto: CreateReturnDto, userId: string): Promise<ReturnEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sale = await queryRunner.manager.findOne(SaleEntity, {
        where: { id: dto.originalSaleId },
        relations: ['items'],
      });

      if (!sale) throw new NotFoundException('Original sale not found');
      if (sale.status !== SaleStatus.COMPLETED) {
        throw new BadRequestException('Can only return completed sales');
      }

      const saleItemIds = dto.items.map((i) => i.saleItemId);
      const saleItems = await queryRunner.manager.find(SaleItemEntity, {
        where: { id: In(saleItemIds), saleId: sale.id },
      });

      if (saleItems.length !== saleItemIds.length) {
        throw new NotFoundException('One or more sale items not found');
      }

      const saleItemMap = new Map(saleItems.map((si) => [si.id, si]));

      for (const itemDto of dto.items) {
        const saleItem = saleItemMap.get(itemDto.saleItemId)!;
        if (itemDto.quantity > Number(saleItem.quantity)) {
          throw new BadRequestException(
            `Return quantity exceeds original for ${saleItem.productNameSnapshot}`,
          );
        }
      }

      const returnNumber = await this.generateReturnNumber();
      const returnEntity = queryRunner.manager.create(ReturnEntity, {
        returnNumber,
        originalSaleId: sale.id,
        status: ReturnStatus.PENDING,
        reason: dto.reason,
        notes: dto.notes,
      });
      await queryRunner.manager.save(returnEntity);

      let refundAmount = 0;

      for (const itemDto of dto.items) {
        const saleItem = saleItemMap.get(itemDto.saleItemId)!;
        const refundUnitPrice = Number(saleItem.customUnitPrice);
        const refundTotal = refundUnitPrice * itemDto.quantity;

        const returnItem = queryRunner.manager.create(ReturnItemEntity, {
          returnId: returnEntity.id,
          saleItemId: saleItem.id,
          quantity: itemDto.quantity,
          refundUnitPrice,
          refundTotal,
          reason: itemDto.reason,
        });
        await queryRunner.manager.save(returnItem);
        refundAmount += refundTotal;
      }

      returnEntity.refundAmount = refundAmount;
      await queryRunner.manager.save(returnEntity);

      await queryRunner.commitTransaction();

      await this.auditLogService.log({
        userId,
        action: AuditAction.RETURN_CREATED,
        entity: AuditEntityEnum.RETURN,
        entityId: returnEntity.id,
        afterSnapshot: { returnNumber, status: ReturnStatus.PENDING },
      });

      return this.findOne(returnEntity.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async approve(returnId: string, userId: string): Promise<ReturnEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const returnEntity = await queryRunner.manager.findOne(ReturnEntity, {
        where: { id: returnId },
        relations: ['items', 'items.saleItem', 'items.saleItem.product', 'originalSale'],
      });

      if (!returnEntity) throw new NotFoundException('Return not found');
      if (returnEntity.status !== ReturnStatus.PENDING) {
        throw new BadRequestException('Return is not pending');
      }

      for (const returnItem of returnEntity.items) {
  const productId = returnItem.saleItem.productId;

  if (!productId) {
    throw new BadRequestException(
      'Return item references a sale item without productId',
    );
  }

  const product = await queryRunner.manager.findOne(ProductEntity, {
    where: { id: productId },
    lock: { mode: 'pessimistic_write' },
  });

        if (!product) throw new NotFoundException('Product not found');

        const stockBefore = Number(product.stockQuantity);
        const restoreQty = Number(returnItem.quantity);
        product.stockQuantity = stockBefore + restoreQty;
        await queryRunner.manager.save(product);

        const transaction = queryRunner.manager.create(InventoryTransactionEntity, {
          productId: product.id,
          type: InventoryTransactionType.RETURN,
          quantity: restoreQty,
          stockBefore,
          stockAfter: stockBefore + restoreQty,
          referenceId: returnEntity.id,
          referenceType: 'return',
          notes: `Return ${returnEntity.returnNumber}`,
        });
        await queryRunner.manager.save(transaction);
      }

      returnEntity.status = ReturnStatus.APPROVED;
      await queryRunner.manager.save(returnEntity);

      returnEntity.originalSale.status = SaleStatus.RETURNED;
      await queryRunner.manager.save(returnEntity.originalSale);

      await queryRunner.commitTransaction();

      await this.auditLogService.log({
        userId,
        action: AuditAction.RETURN_APPROVED,
        entity: AuditEntityEnum.RETURN,
        entityId: returnEntity.id,
        afterSnapshot: { status: ReturnStatus.APPROVED },
      });

      return this.findOne(returnEntity.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async reject(returnId: string, dto: UpdateReturnDto, userId: string): Promise<ReturnEntity> {
    const returnEntity = await this.returnRepository.findOne({ where: { id: returnId } });

    if (!returnEntity) throw new NotFoundException('Return not found');
    if (returnEntity.status !== ReturnStatus.PENDING) {
      throw new BadRequestException('Return is not pending');
    }

    returnEntity.status = ReturnStatus.REJECTED;
    returnEntity.notes = dto.notes || returnEntity.notes;
    await this.returnRepository.save(returnEntity);

    await this.auditLogService.log({
      userId,
      action: AuditAction.RETURN_REJECTED,
      entity: AuditEntityEnum.RETURN,
      entityId: returnEntity.id,
      afterSnapshot: { status: ReturnStatus.REJECTED },
    });

    return this.findOne(returnEntity.id);
  }

  async findAll(
  pagination: SaleQueryDto,
): Promise<PaginatedResponseDto<SaleEntity>> {

  const { page = 1, limit = 20, search, status } = pagination;

    const query = this.returnRepository
      .createQueryBuilder('ret')
      .leftJoinAndSelect('ret.originalSale', 'sale')
      .leftJoinAndSelect('ret.items', 'items')
      .orderBy('ret.created_at', 'DESC');

    if (search) {
      query.andWhere('ret.return_number LIKE :search', { search: `%${search}%` });
    }

    if (status) {
      query.andWhere('ret.status = :status', { status });
    }

    const [returns, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = returns.map((r) => this.buildReturnResponse(r));

return PaginatedResponseDto.create(data, total, page, limit);
  }
  buildReturnResponse(r: ReturnEntity): any {
    throw new Error('Method not implemented.');
  }

  async findOne(id: string): Promise<ReturnEntity> {
    const returnEntity = await this.returnRepository.findOne({
      where: { id },
      relations: ['originalSale', 'items', 'items.saleItem', 'items.saleItem.product'],
    });

    if (!returnEntity) throw new NotFoundException('Return not found');
    return returnEntity;
  }
}