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
  Index,
} from "typeorm";
import { UserEntity } from "../../user/entities/user.entity";
import { SaleItemEntity } from "./sale.item.entity";
import { PaymentEntity } from "../../payments/entities/payment.entity";
import { DebtEntity } from "../../debts/entities/debt.entity";
import { ReturnEntity } from "../../return/entities/return.entity";
import { CustomerEntity } from "../../customers/entities/customer.entity";

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return data ? parseFloat(data) : 0;
  }
}

export enum SaleStatus {
  DRAFT = "DRAFT",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  RETURNED = "RETURNED",
}

@Entity("sales")
@Index(["saleNumber"], { unique: true })
@Index(["status", "createdAt"])
@Index(["customerId"])
export class SaleEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 30 })
  saleNumber!: string;

  @Column({ 
    type: "enum", 
    enum: SaleStatus, 
    default: SaleStatus.DRAFT 
  })
  status!: SaleStatus;

  @Column({ 
    type: "numeric", precision: 14, scale: 2, default: 0,
    transformer: new ColumnNumericTransformer() 
  })
  subtotal!: number;

  @Column({ 
    type: "numeric", precision: 14, scale: 2, default: 0,
    transformer: new ColumnNumericTransformer() 
  })
  totalDiscount!: number;

  @Column({ 
    type: "numeric", precision: 14, scale: 2, default: 0,
    transformer: new ColumnNumericTransformer() 
  })
  grandTotal!: number;

  @Column({ 
    type: "numeric", precision: 14, scale: 2, default: 0,
    transformer: new ColumnNumericTransformer() 
  })
  grossProfit!: number;

  @Column({ 
    type: "numeric", precision: 14, scale: 2, default: 0,
    transformer: new ColumnNumericTransformer() 
  })
  netProfit!: number;

  @Column({ type: "text", nullable: true })
  notes?: string | null;

  @Column({
    type: "timestamp with time zone",
    nullable: true,
    name: "completed_at",
  })
  completedAt?: Date | null;

  @Column({
    type: "timestamp with time zone",
    nullable: true,
    name: "cancelled_at",
  })
  cancelledAt?: Date | null;

  @Column({ type: "text", nullable: true, name: "cancellation_reason" })
  cancellationReason?: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date | null;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId!: string | null;

  @Column({ name: "created_by", type: "uuid" })
  createdById!: string;

  // --- RELATIONSHIPS ---

  @ManyToOne(() => UserEntity, (user) => user.sales, { 
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: UserEntity;

  @ManyToOne(() => CustomerEntity, { nullable: true })
  @JoinColumn({ name: "customer_id" })
  customer?: CustomerEntity;

  @OneToMany(() => SaleItemEntity, (item) => item.sale, {
    cascade: true,
  })
  items!: SaleItemEntity[];

  @OneToMany(() => PaymentEntity, (payment) => payment.sale)
  payments!: PaymentEntity[];

  @OneToOne(() => DebtEntity, (debt) => debt.sale)
  debt?: DebtEntity;

  @OneToMany(() => ReturnEntity, (ret) => ret.originalSale)
  returns?: ReturnEntity[];
}