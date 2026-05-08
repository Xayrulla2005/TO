// ============================================================
// src/sales/entities/sale.item.entity.ts
// ============================================================
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Check,
  Index,
} from 'typeorm';
import { ProductEntity } from '../../products/entities/product.entity';
import { SaleEntity } from './sale.entity';

// PostgreSQL numeric -> JS number transformer
export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return data ? parseFloat(data) : 0;
  }
}

@Entity('sale_items')
@Check('"quantity" > 0')
@Index(['saleId']) // Sale bo'yicha itemlarni tez topish uchun
@Index(['productId']) // Mahsulot statistikasi uchun
export class SaleItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Snapshot fields - sotuv vaqtidagi ma'lumotlar muhrlanadi
  @Column({ type: 'varchar', length: 200, name: 'product_name_snapshot' })
  productNameSnapshot!: string;

  @Column({ type: 'varchar', length: 150, nullable: true, name: 'category_snapshot' })
  categorySnapshot?: string | null;

  @Column({ 
    type: 'numeric', precision: 12, scale: 2, name: 'base_unit_price',
    transformer: new ColumnNumericTransformer()
  })
  baseUnitPrice!: number; // Sotuv vaqtidagi standart sotuv narxi

  @Column({ 
    type: 'numeric', precision: 12, scale: 2, name: 'custom_unit_price',
    transformer: new ColumnNumericTransformer()
  })
  customUnitPrice!: number; // Sotuvchi belgilagan narx

  @Column({ 
    type: 'numeric', precision: 12, scale: 2, name: 'purchase_price_snapshot',
    transformer: new ColumnNumericTransformer()
  })
  purchasePriceSnapshot!: number; // Foyda (profit) ni hisoblash uchun kerak

  @Column({ 
    type: 'numeric', precision: 12, scale: 2, default: 0,
    transformer: new ColumnNumericTransformer()
  })
  quantity!: number;

  @Column({ type: 'varchar', length: 20, name: 'unit_snapshot' })
  unitSnapshot!: string; // kg, dona, metr va h.k.

  @Column({ 
    type: 'numeric', precision: 14, scale: 2, name: 'base_total',
    transformer: new ColumnNumericTransformer()
  })
  baseTotal!: number; // baseUnitPrice * quantity

  @Column({ 
    type: 'numeric', precision: 14, scale: 2, name: 'custom_total',
    transformer: new ColumnNumericTransformer()
  })
  customTotal!: number; // customUnitPrice * quantity

  @Column({ 
    type: 'numeric', precision: 14, scale: 2, default: 0, name: 'discount_amount',
    transformer: new ColumnNumericTransformer()
  })
  discountAmount!: number; // Umumiy chegirma miqdori

  // Relations
  @ManyToOne(() => SaleEntity, (sale) => sale.items, { 
    onDelete: 'CASCADE' // Sotuv o'chirilsa, uning itemlari ham o'chishi kerak
  })
  @JoinColumn({ name: 'sale_id' })
  sale!: SaleEntity;

  @Column({ type: 'uuid', name: 'sale_id' })
  saleId!: string;

  @ManyToOne(() => ProductEntity, (product) => product.saleItems, { 
    nullable: true,
    onDelete: 'SET NULL' // Mahsulot o'chirilsa ham sotuv tarixi saqlanib qoladi (chunki bizda snapshot bor)
  })
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity | null;

  @Column({ type: 'uuid', name: 'product_id', nullable: true })
  productId?: string | null;
}