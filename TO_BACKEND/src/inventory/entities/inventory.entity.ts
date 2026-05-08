import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ProductEntity } from '../../products/entities/product.entity';

// Ma'lumotlar yaxlitligini ta'minlash uchun enumlar
export enum InventoryTransactionType {
  SALE = 'SALE',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  RESTOCK = 'RESTOCK',
}

// PostgreSQL numeric -> JS number transformer (Senior trick)
export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity('inventory_transactions')
// Eng ko'p qidiriladigan ustunlarga indekslar (Tezlik uchun)
@Index(['productId', 'createdAt'])
@Index(['referenceId'])
export class InventoryTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ 
    type: 'enum', 
    enum: InventoryTransactionType 
  })
  type!: InventoryTransactionType;

  @Column({ 
    type: 'numeric', 
    precision: 12, 
    scale: 2, 
    transformer: new ColumnNumericTransformer() 
  })
  quantity!: number; // Musbat = qo'shildi, Manfiy = ayirildi

  @Column({ 
    type: 'numeric', 
    precision: 12, 
    scale: 2, 
    name: 'stock_before',
    transformer: new ColumnNumericTransformer() 
  })
  stockBefore!: number;

  @Column({ 
    type: 'numeric', 
    precision: 12, 
    scale: 2, 
    name: 'stock_after',
    transformer: new ColumnNumericTransformer() 
  })
  stockAfter!: number;

  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'reference_type' })
  referenceType?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => ProductEntity, (product) => product.inventoryTransactions, {
    onDelete: 'CASCADE', // Agar mahsulot o'chirilsa, tarix ham tozalanishi yoki saqlanishi kerak
  })
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;
}