// src/debts/entities/debt.entity.ts
import { SaleEntity } from '../../sale/entities/sale.entity';
import {
  Column as Col2,
  CreateDateColumn as CDC2,
  Entity as Ent2,
  PrimaryGeneratedColumn as PG2,
  OneToOne as OTO2,
  JoinColumn as JC2,
  UpdateDateColumn as UDC2,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CustomerEntity } from '../../customers/entities/customer.entity';

export enum DebtStatus {
  PENDING        = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID           = 'PAID',
  CANCELLED      = 'CANCELLED',
}

@Ent2('debts')
export class DebtEntity {
  @PG2('uuid')
  id!: string;

  @Col2({ type: 'varchar', length: 150, name: 'debtor_name' })
  debtorName!: string;

  // ✅ nullable: true — telefon bo'lmasa ham saqlash mumkin
  @Col2({ type: 'varchar', length: 30, name: 'debtor_phone', nullable: true })
  debtorPhone?: string | null;

  @Col2({ type: 'numeric', precision: 14, scale: 2, name: 'original_amount' })
  originalAmount!: number;

  @Col2({ type: 'numeric', precision: 14, scale: 2, name: 'remaining_amount' })
  remainingAmount!: number;

  @Col2({ type: 'varchar', length: 20, default: DebtStatus.PENDING })
  status!: DebtStatus;

  @Col2({ type: 'timestamp with time zone', nullable: true, name: 'due_date' })
  dueDate?: Date | null;

  @Col2({ type: 'text', nullable: true })
  notes?: string | null;

  @CDC2({ name: 'created_at' })
  createdAt!: Date;

  @UDC2({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @OTO2(() => SaleEntity, (sale) => sale.debt)
  @JC2({ name: 'sale_id' })
  sale!: SaleEntity;

  @Col2({ type: 'uuid', name: 'sale_id' })
  saleId!: string;

  // Mijoz bilan bog'liq (ixtiyoriy)
  @Col2({ type: 'uuid', name: 'customer_id', nullable: true })
  customerId?: string | null;
}