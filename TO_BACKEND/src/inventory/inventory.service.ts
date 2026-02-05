
// ============================================================
// src/inventory/inventory.service.ts
// ============================================================
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryTransactionEntity, InventoryTransactionType } from './entities/inventory.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/entities/audit-log.entity';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

export interface AdjustStockDto {
  productId: string;
  quantityChange: number; // Positive = add, Negative = remove
  notes?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryTransactionEntity)
    private readonly txRepository: Repository<InventoryTransactionEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async adjustStock(dto: AdjustStockDto, userId: string): Promise<InventoryTransactionEntity> {
    const product = await this.productRepository.findOne({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const stockBefore = Number(product.stockQuantity);
    const newStock = stockBefore + dto.quantityChange;

    if (newStock < 0) {
      throw new BadRequestException(
        `Cannot reduce stock below 0. Current: ${stockBefore}, Requested change: ${dto.quantityChange}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(ProductEntity, product.id, {
        stockQuantity: newStock,
      });

      const tx = await queryRunner.manager.save(
        queryRunner.manager.create(InventoryTransactionEntity, {
          type: dto.quantityChange > 0 ? InventoryTransactionType.RESTOCK : InventoryTransactionType.ADJUSTMENT,
          quantity: dto.quantityChange,
          stockBefore,
          stockAfter: newStock,
          productId: product.id,
          referenceType: 'manual_adjustment',
          notes: dto.notes || null,
        }),
      );

      await queryRunner.commitTransaction();

      // Audit log
      await this.auditLogService.log({
        userId,
        action: AuditAction.INVENTORY_ADJUSTED,
        entity: AuditEntity.INVENTORY,
        entityId: tx.id,
        beforeSnapshot: { productId: product.id, stockBefore },
        afterSnapshot: { productId: product.id, stockAfter: newStock, change: dto.quantityChange },
      });

      return tx;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getTransactionsByProduct(productId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<InventoryTransactionEntity>> {
    const { page = 1, limit = 20 } = pagination;

    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const [transactions, total] = await this.txRepository.findAndCount({
      where: { productId },
      relations: ['product'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.create(transactions, total, page, limit);
  }

  async getAllTransactions(pagination: PaginationDto): Promise<PaginatedResponseDto<InventoryTransactionEntity>> {
    const { page = 1, limit = 50 } = pagination;

    const [transactions, total] = await this.txRepository.findAndCount({
      relations: ['product'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.create(transactions, total, page, limit);
  }
}