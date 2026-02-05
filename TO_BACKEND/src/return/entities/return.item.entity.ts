import { SaleItemEntity } from 'src/sale/entities/sale.item.entity';
import {
  Column as Col4,
  Entity as Ent4,
  PrimaryGeneratedColumn as PG4,
  ManyToOne as MO4,
  JoinColumn as JC4,
} from 'typeorm';
import { ReturnEntity } from './return.entity';

@Ent4('return_items')
export class ReturnItemEntity {
  @PG4('uuid')
  id!: string;

  @Col4({ type: 'uuid', name: 'sale_item_id' })
  saleItemId!: string;

  @MO4(() => SaleItemEntity, { eager: true })
  @JC4({ name: 'sale_item_id' })
  saleItem!: SaleItemEntity;

  @MO4(() => ReturnEntity, (ret) => ret.items)
  @JC4({ name: 'return_id' })
  returnRecord!: ReturnEntity;

  @Col4({ type: 'uuid', name: 'return_id' })
  returnId!: string;

  @Col4({ type: 'numeric', precision: 12, scale: 2 })
  quantity!: number;

  @Col4({ type: 'numeric', precision: 14, scale: 2, name: 'refund_unit_price' })
  refundUnitPrice!: number; // The custom_unit_price from original sale item

  @Col4({ type: 'numeric', precision: 14, scale: 2, name: 'refund_total' })
  refundTotal!: number; // refundUnitPrice * quantity

  @Col4({ type: 'text', nullable: true })
  reason?: string | null;
}
