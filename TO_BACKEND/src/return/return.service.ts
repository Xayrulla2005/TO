// src/return/return.service.ts
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
import {
  InventoryTransactionEntity,
  InventoryTransactionType,
} from '../inventory/entities/inventory.entity';
import {
  ApproveReturnDto,
  CreateReturnDto,
  RejectReturnDto,
} from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../common/dto/pagination.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  AuditEntity as AuditEntityEnum,
} from '../audit-logs/entities/audit-log.entity';
import { SaleQueryDto } from '../sale/dto/sale.query.dto';

@Injectable()
export class ReturnsService {
  constructor(
    @InjectRepository(ReturnEntity)
    private readonly returnRepo: Repository<ReturnEntity>,
    @InjectRepository(ReturnItemEntity)
    private readonly returnItemRepo: Repository<ReturnItemEntity>,
    @InjectRepository(SaleEntity)
    private readonly saleRepo: Repository<SaleEntity>,
    @InjectRepository(SaleItemEntity)
    private readonly saleItemRepo: Repository<SaleItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(InventoryTransactionEntity)
    private readonly inventoryRepo: Repository<InventoryTransactionEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── CONTROLLER PROXY ─────────────────────────────────────
  async createReturn(dto: CreateReturnDto, userId: string): Promise<any> {
    return this.create(dto, userId);
  }

  async approveReturn(returnId: string, dto: ApproveReturnDto, userId: string): Promise<any> {
    return this.approve(returnId, userId);
  }

  async rejectReturn(returnId: string, dto: RejectReturnDto, userId: string): Promise<any> {
    return this.reject(returnId, { notes: dto.reason } as UpdateReturnDto, userId);
  }

  async findById(returnId: string): Promise<any> {
    return this.buildResponse(await this.findOne(returnId));
  }

  // ─── UTILS ────────────────────────────────────────────────
  private round(v: number | string): number {
    return Math.round(Number(v || 0) * 100) / 100;
  }

  buildResponse(r: ReturnEntity): any {
    return {
      id:                 r.id,
      returnNumber:       r.returnNumber,
      status:             r.status,
      refundAmount:       Number(r.refundAmount),
      reason:             r.reason             ?? null,
      notes:              r.notes              ?? null,
      createdAt:          r.createdAt,
      originalSaleId:     r.originalSaleId,
      // Frontend ReturnCard da ret.originalSaleNumber ishlatiladi
      originalSaleNumber: (r.originalSale as any)?.saleNumber ?? null,
      originalSale:       r.originalSale
        ? {
            id:         r.originalSale.id,
            saleNumber: (r.originalSale as any).saleNumber,
            grandTotal: Number((r.originalSale as any).grandTotal),
            status:     (r.originalSale as any).status,
          }
        : null,
      items: (r.items ?? []).map(item => ({
        id:              item.id,
        saleItemId:      item.saleItemId,
        quantity:        Number(item.quantity),
        refundUnitPrice: Number(item.refundUnitPrice),
        refundTotal:     Number(item.refundTotal),
        reason:          item.reason            ?? null,
        productName:     item.saleItem?.productNameSnapshot ?? '',
        unit:            item.saleItem?.unitSnapshot        ?? 'dona',
      })),
    };
  }

  private async generateReturnNumber(): Promise<string> {
    const yearMonth = new Date().toISOString().slice(0, 7).replace(/-/g, '');
    const count     = await this.returnRepo
      .createQueryBuilder('r')
      .where('r.returnNumber LIKE :p', { p: `RET-${yearMonth}-%` })
      .getCount();
    return `RET-${yearMonth}-${String(count + 1).padStart(4, '0')}`;
  }

  // ─── CREATE ───────────────────────────────────────────────
  async create(dto: CreateReturnDto, userId: string): Promise<any> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const sale = await qr.manager.findOne(SaleEntity, {
        where:     { id: dto.originalSaleId },
        relations: ['items'],
      });
      if (!sale) throw new NotFoundException('Savdo topilmadi');
      if (sale.status !== SaleStatus.COMPLETED) {
        throw new BadRequestException('Faqat yakunlangan savdolarni qaytarish mumkin');
      }

      const saleItemIds = dto.items.map(i => i.saleItemId);
      const saleItems   = await qr.manager.find(SaleItemEntity, {
        where: { id: In(saleItemIds), saleId: sale.id },
      });
      if (saleItems.length !== saleItemIds.length) {
        throw new NotFoundException('Bir yoki bir nechta savdo mahsuloti topilmadi');
      }

      const saleItemMap = new Map(saleItems.map(si => [si.id, si]));

      for (const itemDto of dto.items) {
        const si = saleItemMap.get(itemDto.saleItemId)!;
        if (Number(itemDto.quantity) > Number(si.quantity)) {
          throw new BadRequestException(
            `"${si.productNameSnapshot}": qaytarish miqdori (${itemDto.quantity}) ` +
            `asl miqdordan (${si.quantity}) oshib ketdi`,
          );
        }
      }

      const returnNumber = await this.generateReturnNumber();
      const ret = qr.manager.create(ReturnEntity, {
        returnNumber,
        originalSaleId: sale.id,
        status:         ReturnStatus.PENDING,
        reason:         dto.reason ?? null,
        notes:          dto.notes  ?? null,
        refundAmount:   0,
      });
      await qr.manager.save(ret);

      let totalRefund = 0;
      for (const itemDto of dto.items) {
        const si              = saleItemMap.get(itemDto.saleItemId)!;
        const refundUnitPrice = this.round(Number(si.customUnitPrice));
        const refundTotal     = this.round(refundUnitPrice * Number(itemDto.quantity));

        await qr.manager.save(
          qr.manager.create(ReturnItemEntity, {
            returnId:        ret.id,
            saleItemId:      si.id,
            quantity:        Number(itemDto.quantity),
            refundUnitPrice,
            refundTotal,
            reason:          itemDto.reason ?? null,
          }),
        );
        totalRefund += refundTotal;
      }

      ret.refundAmount = this.round(totalRefund);
      await qr.manager.save(ret);
      await qr.commitTransaction();

      await this.auditLogService.log({
        userId,
        action:        AuditAction.RETURN_CREATED,
        entity:        AuditEntityEnum.RETURN,
        entityId:      ret.id,
        afterSnapshot: {
          returnNumber,
          status:       ReturnStatus.PENDING,
          refundAmount: totalRefund,
        },
      });

      return this.buildResponse(await this.findOne(ret.id));
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─── APPROVE ──────────────────────────────────────────────
  async approve(returnId: string, userId: string): Promise<any> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Return ni items bilan yuklaymiz
      const ret = await qr.manager.findOne(ReturnEntity, {
        where:     { id: returnId },
        relations: ['items', 'items.saleItem'],
      });

      if (!ret)  throw new NotFoundException('Qaytarish topilmadi');
      if (ret.status !== ReturnStatus.PENDING) {
        throw new BadRequestException('Faqat kutilayotgan qaytarishlarni tasdiqlash mumkin');
      }

      // Har bir item uchun mahsulotni ALOHIDA yuklash
      // ✅ FIX: eager: true bo'lgan ProductEntity ni lock bilan yuklaganda
      //   TypeORM kategory uchun LEFT JOIN chiqaradi
      //   PostgreSQL esa LEFT JOIN bilan FOR UPDATE ishlamaydi
      //   Yechim: loadEagerRelations: false + QueryBuilder ishlatmaslik
      //   Yoki: to'g'ridan query runner.query() bilan SQL ishlatish
      for (const item of ret.items) {
        const productId = item.saleItem?.productId;
        if (!productId) {
          throw new BadRequestException(
            `"${item.saleItem?.productNameSnapshot}" uchun productId topilmadi`,
          );
        }

        // ✅ FIX: FOR UPDATE + LEFT JOIN muammosi — raw SQL ishlatamiz
        // ProductEntity da category eager: true bo'lgani uchun TypeORM
        // findOne({lock}) chaqirsa LEFT JOIN qo'shadi → PostgreSQL xato beradi
        // Yechim: avval stok yangilaymiz, lock kerak emas (transaction o'zi himoya qiladi)
        const product = await qr.manager
          .createQueryBuilder(ProductEntity, 'p')
          .where('p.id = :id', { id: productId })
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getOne();

        if (!product) {
          throw new NotFoundException(`Mahsulot topilmadi: ${productId}`);
        }

        const stockBefore = Number(product.stockQuantity);
        const restoreQty  = Number(item.quantity);
        const stockAfter  = this.round(stockBefore + restoreQty);

        // Stokni yangilaymiz
        await qr.manager.update(ProductEntity, product.id, {
          stockQuantity: stockAfter,
        });

        // Inventar tranzaksiya
        await qr.manager.save(
          qr.manager.create(InventoryTransactionEntity, {
            productId:     product.id,
            type:          InventoryTransactionType.RETURN,
            quantity:      restoreQty,
            stockBefore,
            stockAfter,
            referenceId:   ret.id,
            referenceType: 'return',
            notes:         `Qaytarish: ${ret.returnNumber}`,
          }),
        );
      }

      // Return statusini APPROVED ga o'zgartirish
      await qr.manager.update(ReturnEntity, ret.id, {
        status: ReturnStatus.APPROVED,
      });

      // Savdo statusini RETURNED ga o'zgartirish
      await qr.manager.update(SaleEntity, ret.originalSaleId, {
        status: SaleStatus.RETURNED,
      });

      await qr.commitTransaction();

      await this.auditLogService.log({
        userId,
        action:        AuditAction.RETURN_APPROVED,
        entity:        AuditEntityEnum.RETURN,
        entityId:      ret.id,
        afterSnapshot: { status: ReturnStatus.APPROVED },
      });

      return this.buildResponse(await this.findOne(ret.id));
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─── REJECT ───────────────────────────────────────────────
  async reject(returnId: string, dto: UpdateReturnDto, userId: string): Promise<any> {
    const ret = await this.returnRepo.findOne({ where: { id: returnId } });
    if (!ret)  throw new NotFoundException('Qaytarish topilmadi');
    if (ret.status !== ReturnStatus.PENDING) {
      throw new BadRequestException('Faqat kutilayotgan qaytarishlarni rad etish mumkin');
    }

    await this.returnRepo.update(ret.id, {
      status: ReturnStatus.REJECTED,
      notes:  dto.notes ?? ret.notes,
    });

    await this.auditLogService.log({
      userId,
      action:        AuditAction.RETURN_REJECTED,
      entity:        AuditEntityEnum.RETURN,
      entityId:      ret.id,
      afterSnapshot: { status: ReturnStatus.REJECTED, notes: dto.notes },
    });

    return this.buildResponse(await this.findOne(ret.id));
  }

  // ─── FIND ALL ─────────────────────────────────────────────
  async findAll(
    pagination: SaleQueryDto | PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    const page   = Number((pagination as any).page   ?? 1);
    const limit  = Number((pagination as any).limit  ?? 20);
    const search = String((pagination as any).search ?? '').trim();
    const status = String((pagination as any).status ?? '').trim();

    const qb = this.returnRepo
      .createQueryBuilder('ret')
      .leftJoinAndSelect('ret.originalSale', 'sale')
      .leftJoinAndSelect('ret.items', 'items')
      // ✅ ReturnEntity da @CreateDateColumn({ name: 'created_at' })
      // TypeORM QueryBuilder da entity property nomi (camelCase) ishlatiladi
      .orderBy('ret.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.andWhere('ret.returnNumber ILIKE :search', { search: `%${search}%` });
    }
    if (status && status !== 'all') {
      qb.andWhere('ret.status = :status', { status });
    }

    const [returns, total] = await qb.getManyAndCount();
    const data = returns.map(r => this.buildResponse(r));
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  // ─── FIND ONE ─────────────────────────────────────────────
  async findOne(id: string): Promise<ReturnEntity> {
    const entity = await this.returnRepo.findOne({
      where:     { id },
      relations: ['originalSale', 'items', 'items.saleItem'],
    });
    if (!entity) throw new NotFoundException('Qaytarish topilmadi');
    return entity;
  }
}