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
import { CustomerEntity } from '../../customers/entities/customer.entity';

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
  saleNumber!: string;

  @Column({ type: 'varchar', length: 20, default: SaleStatus.DRAFT })
  status!: SaleStatus;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalDiscount!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  grandTotal!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  grossProfit!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  netProfit!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  // ── Mijoz (ixtiyoriy) ─────────────────────────────────────
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string | null;

  @ManyToOne(() => CustomerEntity, (customer) => customer.sales, {
    nullable: true,
    eager: false,
  })
  @JoinColumn({ name: 'customer_id' })
  customer?: CustomerEntity | null;

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

  @Column({ name: 'created_by', type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => UserEntity, (user) => user.sales, { eager: true })
  @JoinColumn({ name: 'created_by' })
  createdBy!: UserEntity;

  @OneToMany(() => SaleItemEntity, (item) => item.sale, { eager: true, cascade: true })
  items!: SaleItemEntity[];

  @OneToMany(() => PaymentEntity, (payment) => payment.sale, { eager: true })
  payments!: PaymentEntity[];

  @OneToOne(() => DebtEntity, (debt) => debt.sale)
  debt?: DebtEntity;

  @OneToMany(() => ReturnEntity, (ret) => ret.originalSale)
  returns?: ReturnEntity[];
}