import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Check,
} from 'typeorm';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { SaleItemEntity } from '../../sale/entities/sale.item.entity';
import { InventoryTransactionEntity } from '../../inventory/entities/inventory.entity';

export enum ProductUnit {
  PIECE = 'piece',
  METER = 'meter',
  KG    = 'kg',
  LITRE = 'litre',
}

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  [ProductUnit.PIECE]: 'dona',
  [ProductUnit.METER]: 'metr',
  [ProductUnit.KG]:    'kg',
  [ProductUnit.LITRE]: 'litr',
};

@Entity('products')
@Check('"purchase_price" >= 0')
@Check('"sale_price" >= 0')
@Check('"stock_quantity" >= 0')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @ManyToOne(() => CategoryEntity, (cat) => cat.products, {
    eager: true,
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'category_id' })
  category?: CategoryEntity | null;

  @Column({ type: 'uuid', nullable: true, name: 'category_id' })
  categoryId?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, name: 'purchase_price' })
  purchasePrice!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, name: 'sale_price' })
  salePrice!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl?: string | null;

  @Column({
    type: 'enum',
    enum: ProductUnit,
    default: ProductUnit.PIECE,
  })
  unit!: ProductUnit;

  // ✅ INT → NUMERIC: metr/kg/litr uchun 1.5, 2.75 bo'lishi mumkin
  @Column({
    name: 'stock_quantity',
    type: 'numeric',
    precision: 12,
    scale: 3,   // 3 xonagacha: 1.500 metr
    default: 0,
  })
  stockQuantity!: number;

  @Column({ type: 'numeric', precision: 12, scale: 3, default: 0, name: 'min_stock_limit' })
  minStockLimit!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date | null;

  @OneToMany(() => SaleItemEntity, (item) => item.product)
  saleItems?: SaleItemEntity[];

  @OneToMany(() => InventoryTransactionEntity, (tx) => tx.product)
  inventoryTransactions?: InventoryTransactionEntity[];

  get isLowStock(): boolean {
    return Number(this.stockQuantity) <= Number(this.minStockLimit);
  }
}