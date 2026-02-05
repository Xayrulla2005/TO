export class Product {}
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
  METER = 'meter',
  PIECE = 'piece',
  PACK = 'pack',
}

@Entity('products')
@Check('"purchase_price" >= 0')
@Check('"sale_price" >= 0')
@Check('"stock_quantity" >= 0')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @ManyToOne(() => CategoryEntity, (cat) => cat.products, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: CategoryEntity | null;

  @Column({ type: 'uuid', nullable: true, name: 'category_id' })
  categoryId?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  purchasePrice!: number; // Cost price (what we paid)

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  salePrice!: number; // Base selling price

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl?: string | null; // Relative path to uploaded image

  @Column({ type: 'varchar', length: 20, default: ProductUnit.PIECE })
  unit!: ProductUnit;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  stockQuantity!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, name: 'min_stock_limit' })
  minStockLimit!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date | null;

  // Relations
  @OneToMany(() => SaleItemEntity, (item) => item.product)
  saleItems?: SaleItemEntity[];

  @OneToMany(() => InventoryTransactionEntity, (tx) => tx.product)
  inventoryTransactions?: InventoryTransactionEntity[];

  // Helper: is stock below minimum?
  get isLowStock(): boolean {
    return Number(this.stockQuantity) <= Number(this.minStockLimit);
  }
}
