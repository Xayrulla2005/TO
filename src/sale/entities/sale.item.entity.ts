import {
  Column as Col2,
  Entity as Ent2,
  PrimaryGeneratedColumn as PG2,
  ManyToOne as MO2,
  JoinColumn as JC2,
  Check as Chk2,
} from 'typeorm';
import { ProductEntity } from '../../products/entities/product.entity';
import { SaleEntity } from './sale.entity';

@Ent2('sale_items')
@Chk2('"quantity" > 0')
export class SaleItemEntity {
  @PG2('uuid')
  id!: string;

  // Snapshot fields - immutable once sale is COMPLETED
  @Col2({ type: 'varchar', length: 200, name: 'product_name_snapshot' })
  productNameSnapshot!: string;

  @Col2({ type: 'varchar', length: 150, nullable: true, name: 'category_snapshot' })
  categorySnapshot?: string | null;

  @Col2({ type: 'numeric', precision: 12, scale: 2, name: 'base_unit_price' })
  baseUnitPrice!: number; // product.salePrice at time of sale

  @Col2({ type: 'numeric', precision: 12, scale: 2, name: 'custom_unit_price' })
  customUnitPrice!: number; // Saler can override this

  @Col2({ type: 'numeric', precision: 12, scale: 2, name: 'purchase_price_snapshot' })
  purchasePriceSnapshot!: number; // product.purchasePrice at time of sale

  @Col2({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  quantity!: number;

  @Col2({ type: 'varchar', length: 20, name: 'unit_snapshot' })
  unitSnapshot!: string; // product.unit at time of sale

  @Col2({ type: 'numeric', precision: 14, scale: 2, name: 'base_total' })
  baseTotal!: number; // baseUnitPrice * quantity

  @Col2({ type: 'numeric', precision: 14, scale: 2, name: 'custom_total' })
  customTotal!: number; // customUnitPrice * quantity

  @Col2({ type: 'numeric', precision: 14, scale: 2, default: 0, name: 'discount_amount' })
  discountAmount!: number; // Per-item discount

  // Relations
  @MO2(() => SaleEntity, (sale) => sale.items)
  @JC2({ name: 'sale_id' })
  sale!: SaleEntity;

  @Col2({ type: 'uuid', name: 'sale_id' })
  saleId!: string;

  @MO2(() => ProductEntity, (product) => product.saleItems, { nullable: true })
  @JC2({ name: 'product_id' })
  product?: ProductEntity | null;

  @Col2({ type: 'uuid', name: 'product_id', nullable: true })
  productId?: string | null;
}
