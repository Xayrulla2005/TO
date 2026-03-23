import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DebtEntity } from './debt.entity';

export enum DebtPaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
}

@Entity('debt_payments')
export class DebtPaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'debt_id' })
  debtId!: string;

  @ManyToOne(() => DebtEntity, (debt) => debt.payments)
  @JoinColumn({ name: 'debt_id' })
  debt!: DebtEntity;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: number;

  @Column({
    type: 'varchar',
    length: 10,
    name: 'payment_method',
    default: DebtPaymentMethod.CASH,
  })
  paymentMethod!: DebtPaymentMethod;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById?: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'remaining_before' })
  remainingBefore!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'remaining_after' })
  remainingAfter!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}