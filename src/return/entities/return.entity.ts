import {
  Column as Col3,
  CreateDateColumn as CDC3,
  Entity as Ent3,
  PrimaryGeneratedColumn as PG3,
  ManyToOne as MO3,
  JoinColumn as JC3,
  OneToMany as OTM3,
} from 'typeorm';
import { ReturnItemEntity } from './return.item.entity';
import { SaleEntity } from '../../sale/entities/sale.entity';

export enum ReturnStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Ent3('returns')
export class ReturnEntity {
  @PG3('uuid')
  id!: string;

  @Col3({ type: 'varchar', length: 30, unique: true, name: 'return_number' })
  returnNumber!: string; // e.g., RET-2024-001234

  @Col3({ type: 'varchar', length: 20, default: ReturnStatus.PENDING })
  status!: ReturnStatus;

  @Col3({ type: 'numeric', precision: 14, scale: 2, default: 0, name: 'refund_amount' })
  refundAmount!: number;

  @Col3({ type: 'text', nullable: true })
  reason?: string | null;

  @Col3({ type: 'text', nullable: true })
  notes?: string | null;

  @CDC3({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @MO3(() => SaleEntity, (sale) => sale.returns)
  @JC3({ name: 'original_sale_id' })
  originalSale!: SaleEntity;

  @Col3({ type: 'uuid', name: 'original_sale_id' })
  originalSaleId!: string;

  @OTM3(() => ReturnItemEntity, (item) => item.returnRecord, { eager: true, cascade: true })
  items!: ReturnItemEntity[];
}