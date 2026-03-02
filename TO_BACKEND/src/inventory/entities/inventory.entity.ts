import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductEntity } from '../../products/entities/product.entity';

export enum InventoryTransactionType {
  SALE = 'SALE',           // Stock decreased on sale completion
  RETURN = 'RETURN',       // Stock increased on return approval
  ADJUSTMENT = 'ADJUSTMENT', // Manual stock adjustment by admin
  RESTOCK = 'RESTOCK',     // Restocking inventory
}

@Entity('inventory_transactions')
export class InventoryTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  type!: InventoryTransactionType;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  quantity!: number; // Positive = added, Negative = removed

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'stock_before' })
  stockBefore!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'stock_after' })
  stockAfter!: number;

  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId?: string | null; // sale_id, return_id, etc.

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'reference_type' })
  referenceType?: string | null; // 'sale', 'return', 'adjustment'

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => ProductEntity, (product) => product.inventoryTransactions)
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;
}
