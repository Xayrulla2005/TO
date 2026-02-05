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
  OneToOne,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';
import { SaleItemEntity } from './sale.item.entity';
import { PaymentEntity } from '../../payments/entities/payment.entity';
import { DebtEntity } from '../../debts/entities/debt.entity';
import { ReturnEntity } from '../../return/entities/return.entity';

export enum SaleStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

@Entity('sales')
export class SaleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  saleNumber!: string; // e.g., SALE-2024-001234

  @Column({ type: 'varchar', length: 20, default: SaleStatus.DRAFT })
  status!: SaleStatus;

  // Financial summary (denormalized for fast reporting)
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtotal!: number; // Sum of custom_total across items

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalDiscount!: number; // Sum of discount_amount across items

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  grandTotal!: number; // subtotal - totalDiscount

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  grossProfit!: number; // Sum of (custom_unit_price - purchase_price) * quantity

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  netProfit!: number; // grossProfit - totalDiscount

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  // Timestamps
  @Column({ type: 'timestamp with time zone', nullable: true, name: 'completed_at' })
  completedAt?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'cancelled_at' })
  cancelledAt?: Date | null;

  @Column({ type: 'text', nullable: true, name: 'cancellation_reason' })
  cancellationReason?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date | null;

  // Relations
  @ManyToOne(() => UserEntity, (user) => user.sales, { eager: true })
  @JoinColumn({ name: 'created_by' })
  createdBy!: UserEntity;

  @Column({ type: 'uuid', name: 'created_by' })
  createdById!: string;

  @OneToMany(() => SaleItemEntity, (item) => item.sale, { eager: true, cascade: true })
  items!: SaleItemEntity[];

  @OneToMany(() => PaymentEntity, (payment) => payment.sale, { eager: true })
  payments!: PaymentEntity[];

  @OneToOne(() => DebtEntity, (debt) => debt.sale)
  debt?: DebtEntity;

  @OneToMany(() => ReturnEntity, (ret) => ret.originalSale)
  returns?: ReturnEntity[];
}