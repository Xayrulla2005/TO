import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SaleEntity } from '../../sale/entities/sale.entity';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  DEBT = 'DEBT',
}

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    // agar database da allaqachon varchar bo'lsa:
    // type: 'varchar',
    // length: 20,
  })
  method!: PaymentMethod;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => SaleEntity, (sale) => sale.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: SaleEntity;

  @Column({ type: 'uuid', name: 'sale_id' })
  saleId!: string;
}