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
import { Response } from 'express';
import * as ExcelJS from 'exceljs';

export interface AdjustStockDto {
  productId: string;
  quantityChange: number; // Musbat = qo'shish, Manfiy = ayirish
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

  /**
   * Ombor qoldig'ini o'zgartirish va tarixini saqlash (Tranzaksiya bilan)
   */
  async adjustStock(dto: AdjustStockDto, userId: string): Promise<InventoryTransactionEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Pessimistic Write Lock: Bir vaqtning o'zida bir nechta odam bitta mahsulotni 
      // o'zgartirsa, ma'lumotlar chalkashib ketmasligini ta'minlaydi.
      const product = await queryRunner.manager.findOne(ProductEntity, {
        where: { id: dto.productId },
        lock: { mode: 'pessimistic_write' }, 
      });

      if (!product) {
        throw new NotFoundException('Mahsulot topilmadi');
      }

      const stockBefore = Number(product.stockQuantity);
      const newStock = stockBefore + dto.quantityChange;

      // Manfiy qoldiqqa tushib ketishni tekshirish
      if (newStock < 0) {
        throw new BadRequestException(
          `Omborda yetarli tovar yo'q. Joriy qoldiq: ${stockBefore}, so'ralgan o'zgarish: ${dto.quantityChange}`
        );
      }

      // 2. Mahsulot qoldig'ini yangilash
      await queryRunner.manager.update(ProductEntity, product.id, {
        stockQuantity: newStock,
      });

      // 3. Ombor harakati tarixini yaratish
      const inventoryTx = queryRunner.manager.create(InventoryTransactionEntity, {
        type: dto.quantityChange > 0 ? InventoryTransactionType.RESTOCK : InventoryTransactionType.ADJUSTMENT,
        quantity: dto.quantityChange,
        stockBefore,
        stockAfter: newStock,
        productId: product.id,
        referenceType: 'manual_adjustment',
        notes: dto.notes || 'Qo\'lda kiritilgan o\'zgarish',
      });

      const savedTx = await queryRunner.manager.save(inventoryTx);

      // Hammasi muvaffaqiyatli bo'lsa, bazaga saqlaymiz
      await queryRunner.commitTransaction();

      // 4. Audit Log (Fon rejimida bajariladi, asosiy tranzaksiyani ushlab turmaydi)
      this.auditLogService.log({
        userId,
        action: AuditAction.INVENTORY_ADJUSTED,
        entity: AuditEntity.INVENTORY,
        entityId: savedTx.id,
        beforeSnapshot: { productId: product.id, stockBefore },
        afterSnapshot: { productId: product.id, stockAfter: newStock, change: dto.quantityChange },
      }).catch(err => console.error('Audit log saqlashda xatolik:', err));

      return savedTx;
    } catch (error) {
      // Xato bo'lsa, barcha o'zgarishlarni bekor qilamiz
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Ulanishni bo'shatamiz
      await queryRunner.release();
    }
  }

  /**
   * Barcha ombor harakatlarini Excel formatida yuklab olish
   */
  async downloadExcel(res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ombor Harakatlari');

    // Ustunlar sarlavhasi
    worksheet.columns = [
      { header: 'Sana', key: 'date', width: 25 },
      { header: 'Mahsulot nomi', key: 'product', width: 35 },
      { header: 'Harakat turi', key: 'type', width: 15 },
      { header: 'O\'zgarish miqdori', key: 'qty', width: 18 },
      { header: 'Oldingi qoldiq', key: 'before', width: 15 },
      { header: 'Yangi qoldiq', key: 'after', width: 15 },
      { header: 'Izoh/Notes', key: 'notes', width: 40 },
    ];

    // Sarlavhani formatlash (Bold va Rang)
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '2F5597' },
      };
      cell.alignment = { horizontal: 'center' };
    });

    // Ma'lumotlarni bazadan olish (Oxirgi 10,000 tagacha harakat)
    const transactions = await this.txRepository.find({
      relations: ['product'],
      order: { createdAt: 'DESC' },
      take: 10000,
    });

    // Ma'lumotlarni qatorlarga qo'shish
    transactions.forEach(t => {
      worksheet.addRow({
        date: t.createdAt.toLocaleString('uz-UZ'),
        product: t.product?.name || 'O\'chirilgan mahsulot',
        type: t.type,
        qty: t.quantity,
        before: t.stockBefore,
        after: t.stockAfter,
        notes: t.notes || '',
      });
    });

    // Response headerlarini sozlash
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Ombor_Hisoboti_${new Date().toISOString().split('T')[0]}.xlsx`,
    );

    // Faylni yuborish
    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Mahsulot bo'yicha tranzaksiyalar (Pagination bilan)
   */
  async getTransactionsByProduct(
    productId: string, 
    pagination: PaginationDto
  ): Promise<PaginatedResponseDto<InventoryTransactionEntity>> {
    const { page = 1, limit = 20 } = pagination;

    const [transactions, total] = await this.txRepository.findAndCount({
      where: { productId },
      relations: ['product'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.create(transactions, total, page, limit);
  }

  /**
   * Barcha tranzaksiyalar (Pagination bilan)
   */
  async getAllTransactions(
    pagination: PaginationDto
  ): Promise<PaginatedResponseDto<InventoryTransactionEntity>> {
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