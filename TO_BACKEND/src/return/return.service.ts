// ============================================================
// src/returns/returns.service.ts
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
import {
  InventoryTransactionEntity,
  InventoryTransactionType,
} from '../inventory/entities/inventory.entity';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  AuditEntity as AuditEntityEnum,
} from '../audit-logs/entities/audit-log.entity';
import { Response } from 'express';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReturnsService {
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
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.returnRepository
      .createQueryBuilder('ret')
      .withDeleted()
      .where(`ret.returnNumber LIKE :pattern`, { pattern: `RET-${dateStr}-%` })
      .getCount();
    return `RET-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  // ── Yangi qaytarish yaratish ──────────────────────────────
  async createReturn(dto: CreateReturnDto, userId: string): Promise<ReturnEntity> {
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

      // Har bir item uchun avvalgi qaytarishlarni ham tekshiramiz
      for (const itemDto of dto.items) {
        const saleItem = saleItemMap.get(itemDto.saleItemId)!;
        const originalQty = Number(saleItem.quantity);

        // Bu saleItem uchun allaqachon qaytarilgan miqdor
        const alreadyReturned = await queryRunner.manager
          .createQueryBuilder(ReturnItemEntity, 'ri')
          .innerJoin('ri.returnRecord', 'ret')
          .where('ri.saleItemId = :id', { id: saleItem.id })
          .andWhere('ret.status IN (:...statuses)', {
            statuses: [ReturnStatus.PENDING, ReturnStatus.APPROVED],
          })
          .select('SUM(ri.quantity)', 'total')
          .getRawOne();

        const alreadyReturnedQty = parseFloat(alreadyReturned?.total || '0');
        const maxReturnable = originalQty - alreadyReturnedQty;

        if (itemDto.quantity > maxReturnable) {
          throw new BadRequestException(
            `"${saleItem.productNameSnapshot}" uchun qaytarish miqdori (${itemDto.quantity}) ` +
            `ruxsat etilganidan oshib ketdi. Qaytarish mumkin: ${maxReturnable}`,
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
        afterSnapshot: {
          returnNumber,
          status: ReturnStatus.PENDING,
          refundAmount,
          saleNumber: sale.saleNumber,
        },
        metadata: { saleNumber: sale.saleNumber },
      });

      return this.findOne(returnEntity.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Qaytarishni tasdiqlash (ADMIN) — stokni tiklaydi ─────
  async approveReturn(returnId: string, userId: string): Promise<ReturnEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const returnEntity = await queryRunner.manager.findOne(ReturnEntity, {
        where: { id: returnId },
        relations: ['items', 'items.saleItem', 'originalSale', 'originalSale.items'],
      });

      if (!returnEntity) throw new NotFoundException('Return not found');
      if (returnEntity.status !== ReturnStatus.PENDING) {
        throw new BadRequestException('Return is not pending');
      }

      // Stokni tiklash
      for (const returnItem of returnEntity.items) {
        const productId = returnItem.saleItem?.productId;
        if (!productId) continue;

        const product = await queryRunner.manager
          .createQueryBuilder(ProductEntity, 'p')
          .where('p.id = :id', { id: productId })
          .setLock('pessimistic_write')
          .getOne();

        if (!product) continue;

        const stockBefore = parseFloat(String(product.stockQuantity));
        const restoreQty  = parseFloat(String(returnItem.quantity));
        const stockAfter  = parseFloat((stockBefore + restoreQty).toFixed(3));

        await queryRunner.query(
          `UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [stockAfter, product.id],
        );

        const transaction = queryRunner.manager.create(InventoryTransactionEntity, {
          productId: product.id,
          type: InventoryTransactionType.RETURN,
          quantity: restoreQty,
          stockBefore,
          stockAfter,
          referenceId: returnEntity.id,
          referenceType: 'return',
          notes: `Return ${returnEntity.returnNumber}`,
        });
        await queryRunner.manager.save(transaction);
      }

      // Qaytarish holatini yangilash
      returnEntity.status = ReturnStatus.APPROVED;
      await queryRunner.manager.save(returnEntity);

      // Savdo holatini yangilash — qisman qaytarish bo'lsa COMPLETED qoladi
      const sale = returnEntity.originalSale;
      const totalOriginalQty = sale.items.reduce(
        (s, i) => s + parseFloat(String(i.quantity)), 0
      );
      const totalReturnedQty = returnEntity.items.reduce(
        (s, i) => s + parseFloat(String(i.quantity)), 0
      );

      if (totalReturnedQty >= totalOriginalQty) {
        sale.status = SaleStatus.RETURNED;
        await queryRunner.manager.save(sale);
      }
      // Qisman qaytarishda savdo COMPLETED bo'lib qoladi

      await queryRunner.commitTransaction();

      await this.auditLogService.log({
        userId,
        action: AuditAction.RETURN_APPROVED,
        entity: AuditEntityEnum.RETURN,
        entityId: returnEntity.id,
        afterSnapshot: {
          status: ReturnStatus.APPROVED,
          returnNumber: returnEntity.returnNumber,
          refundAmount: Number(returnEntity.refundAmount),
        },
        metadata: { returnNumber: returnEntity.returnNumber },
      });

      return this.findOne(returnEntity.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Qaytarishni rad etish (ADMIN) ─────────────────────────
  async rejectReturn(returnId: string, dto: UpdateReturnDto, userId: string): Promise<ReturnEntity> {
    const returnEntity = await this.returnRepository.findOne({ where: { id: returnId } });
    if (!returnEntity) throw new NotFoundException('Return not found');
    if (returnEntity.status !== ReturnStatus.PENDING) {
      throw new BadRequestException('Return is not pending');
    }

    returnEntity.status = ReturnStatus.REJECTED;
    if (dto.notes) returnEntity.notes = dto.notes;
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

  async findAll(pagination: { page?: number; limit?: number }, status?: string): Promise<PaginatedResponseDto<any>> {
    const page  = Number(pagination.page  ?? 1);
    const limit = Number(pagination.limit ?? 20);

    const qb = this.returnRepository
      .createQueryBuilder('ret')
      .leftJoinAndSelect('ret.originalSale', 'sale')
      .leftJoinAndSelect('ret.items', 'items')
      .orderBy('ret.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      qb.andWhere('ret.status = :status', { status });
    }

    const [returns, total] = await qb.getManyAndCount();

    return PaginatedResponseDto.create(
      returns.map((r) => this.buildReturnResponse(r)),
      total, page, limit,
    );
  }

  buildReturnResponse(r: ReturnEntity): any {
    return {
      id: r.id,
      returnNumber: r.returnNumber,
      status: r.status,
      refundAmount: Number(r.refundAmount),
      reason: r.reason,
      notes: r.notes,
      createdAt: r.createdAt,
      originalSaleId: r.originalSaleId,
      originalSaleNumber: r.originalSale?.saleNumber,
      items: (r.items || []).map((i) => ({
        id: i.id,
        saleItemId: i.saleItemId,
        productName: i.saleItem?.productNameSnapshot,
        quantity: Number(i.quantity),
        refundUnitPrice: Number(i.refundUnitPrice),
        refundTotal: Number(i.refundTotal),
        reason: i.reason,
      })),
    };
  }

  async findById(returnId: string): Promise<any> {
    const r = await this.findOne(returnId);
    return this.buildReturnResponse(r);
  }

  async findOne(id: string): Promise<ReturnEntity> {
    const returnEntity = await this.returnRepository.findOne({
      where: { id },
      relations: ['originalSale', 'originalSale.items', 'items', 'items.saleItem'],
    });
    if (!returnEntity) throw new NotFoundException('Return not found');
    return returnEntity;
  }

  // ── Qaytarish cheki ───────────────────────────────────────
  async generateReceipt(returnId: string, res: Response): Promise<void> {
    const ret = await this.findOne(returnId);
    const sale = ret.originalSale;

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=return-${ret.returnNumber}.pdf`,
    );
    doc.pipe(res);

    const W = doc.page.width;
    const L = 40, R = W - 40, PW = R - L;

    const fmt = (v: number | string) =>
      '$' + Number(v).toLocaleString('uz-UZ', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

    const fmtDate = (d?: Date | string) => {
      if (!d) return '-';
      return new Date(d).toLocaleDateString('uz-UZ', {
        timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric',
      });
    };

    const fmtTime = (d?: Date | string) => {
      if (!d) return '';
      return new Date(d).toLocaleTimeString('uz-UZ', {
        timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit',
      });
    };

    const hline = (y: number, lw = 0.5, color = '#cccccc') =>
      doc.save().moveTo(L, y).lineTo(R, y).lineWidth(lw).strokeColor(color).stroke().restore();

    const fillRect = (x: number, y: number, w: number, h: number, color: string) =>
      doc.save().rect(x, y, w, h).fillColor(color).fill().restore();

    const cell = (
      txt: string, x: number, y: number, w: number,
      opts: { align?: 'left' | 'right' | 'center'; bold?: boolean; size?: number; color?: string } = {}
    ) =>
      doc.save()
        .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(opts.size || 9)
        .fillColor(opts.color || '#1a1a1a')
        .text(txt, x + 4, y + 3, { width: w - 8, align: opts.align || 'left', lineBreak: false })
        .restore();

    // ── HEADER ──
    fillRect(L, 40, PW, 44, '#7c3aed');
    doc.save().font('Helvetica-Bold').fontSize(18).fillColor('#ffffff')
      .text('TANIROVKA OPTOM', L, 50, { width: PW, align: 'center' }).restore();

    fillRect(L, 84, PW, 20, '#6d28d9');
    doc.save().font('Helvetica').fontSize(9).fillColor('#ddd6fe')
      .text('QAYTARISH CHEKI / RETURN RECEIPT', L, 89, { width: PW, align: 'center' }).restore();

    let y = 116;

    // ── Chek ma'lumotlari ──
    const now = new Date();
    doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text('Qaytarish raqami:', L, y).restore();
    doc.save().font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text(ret.returnNumber, L + 90, y).restore();
    doc.save().font('Helvetica').fontSize(9).fillColor('#64748b')
      .text(`${fmtDate(now)}  ${fmtTime(now)}`, L, y, { width: PW, align: 'right' }).restore();

    y += 16;
    doc.save().font('Helvetica').fontSize(9).fillColor('#64748b').text('Asl savdo:', L, y).restore();
    doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#7c3aed').text(`#${sale.saleNumber}`, L + 55, y).restore();
    doc.save().font('Helvetica').fontSize(9).fillColor('#64748b')
      .text(`${fmtDate(sale.completedAt || sale.createdAt)}`, L, y, { width: PW, align: 'right' }).restore();

    y += 20;
    hline(y, 0.5, '#e2e8f0');
    y += 8;

    // ── Holat ──
    const statusColors: Record<string, string> = {
      PENDING:  '#f59e0b',
      APPROVED: '#16a34a',
      REJECTED: '#dc2626',
    };
    const statusLabels: Record<string, string> = {
      PENDING:  'Kutilmoqda',
      APPROVED: 'Tasdiqlandi',
      REJECTED: 'Rad etildi',
    };
    fillRect(L, y, PW, 22, '#f8fafc');
    doc.save().font('Helvetica').fontSize(9).fillColor('#64748b').text('Holat:', L + 8, y + 6).restore();
    doc.save().font('Helvetica-Bold').fontSize(9).fillColor(statusColors[ret.status] || '#64748b')
      .text(statusLabels[ret.status] || ret.status, L, y + 6, { width: PW - 8, align: 'right' }).restore();
    y += 28;

    if (ret.reason) {
      fillRect(L, y, PW, 20, '#fef9c3');
      doc.save().font('Helvetica').fontSize(9).fillColor('#92400e')
        .text(`Sabab: ${ret.reason}`, L + 8, y + 5, { width: PW - 16, lineBreak: false }).restore();
      y += 26;
    }

    // ── Jadval ──
    const col = {
      no:    { x: L,       w: 25  },
      name:  { x: L + 25,  w: 230 },
      qty:   { x: L + 255, w: 65  },
      price: { x: L + 320, w: 95  },
      total: { x: L + 415, w: 100 },
    };

    fillRect(L, y, PW, 22, '#7c3aed');
    cell('Nr',      col.no.x,    y, col.no.w,    { bold: true, color: '#ffffff', align: 'center' });
    cell('Mahsulot',col.name.x,  y, col.name.w,  { bold: true, color: '#ffffff' });
    cell('Miqdor',  col.qty.x,   y, col.qty.w,   { bold: true, color: '#ffffff', align: 'center' });
    cell('Narxi',   col.price.x, y, col.price.w, { bold: true, color: '#ffffff', align: 'right' });
    cell('Jami',    col.total.x, y, col.total.w, { bold: true, color: '#ffffff', align: 'right' });
    y += 22;

    const vlines = [col.no.x + col.no.w, col.qty.x, col.price.x, col.total.x];

    ret.items.forEach((item, idx) => {
      const isEven = idx % 2 === 0;
      const nameLines = Math.ceil((item.saleItem?.productNameSnapshot || '').length / 30);
      const rowH = Math.max(20, nameLines * 12 + 8);

      fillRect(L, y, PW, rowH, isEven ? '#f8fafc' : '#ffffff');

      cell(`${idx + 1}`, col.no.x, y, col.no.w, { align: 'center', color: '#64748b', size: 8 });
      doc.save().font('Helvetica').fontSize(9).fillColor('#1e293b')
        .text(item.saleItem?.productNameSnapshot || '-', col.name.x + 4, y + 3, {
          width: col.name.w - 8, lineBreak: true,
        }).restore();
      cell(String(parseFloat(String(item.quantity))), col.qty.x, y, col.qty.w, { align: 'center' });
      cell(fmt(item.refundUnitPrice), col.price.x, y, col.price.w, { align: 'right' });
      cell(fmt(item.refundTotal), col.total.x, y, col.total.w, { align: 'right', bold: true });

      hline(y + rowH, 0.3, '#e2e8f0');
      vlines.forEach((vx) =>
        doc.save().moveTo(vx, y).lineTo(vx, y + rowH).lineWidth(0.3).strokeColor('#e2e8f0').stroke().restore()
      );
      y += rowH;
    });

    const tableH = 22 + ret.items.reduce((s, item) => {
      return s + Math.max(20, Math.ceil((item.saleItem?.productNameSnapshot || '').length / 30) * 12 + 8);
    }, 0);
    doc.save().rect(L, y - tableH, PW, tableH).lineWidth(0.8).strokeColor('#7c3aed').stroke().restore();

    y += 8;

    // ── Jami qaytarish summasi ──
    fillRect(L, y, PW, 28, '#7c3aed');
    doc.save().font('Helvetica-Bold').fontSize(12).fillColor('#ffffff')
      .text('QAYTARILGAN SUMMA:', L + 8, y + 7).restore();
    doc.save().font('Helvetica-Bold').fontSize(14).fillColor('#fbbf24')
      .text(fmt(ret.refundAmount), L, y + 5, { width: PW - 8, align: 'right' }).restore();
    y += 36;

    // ── Footer ──
    y += 10;
    hline(y, 0.5, '#e2e8f0');
    y += 10;
    doc.save().font('Helvetica').fontSize(9).fillColor('#94a3b8')
      .text('Xaridingiz uchun tashakkur!', L, y, { width: PW, align: 'center' }).restore();
    y += 13;
    doc.save().font('Helvetica').fontSize(8).fillColor('#cbd5e1')
      .text('Yana tashrif buyuring • tanirovkaoptom.uz', L, y, { width: PW, align: 'center' }).restore();

    doc.end();
  }
}