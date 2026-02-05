import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';

export enum AuditAction {
  // Auth
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',

  // CRUD Generic
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  RESTORED = 'RESTORED',

  // Sales
  SALE_CREATED = 'SALE_CREATED',
  SALE_COMPLETED = 'SALE_COMPLETED',
  SALE_CANCELLED = 'SALE_CANCELLED',
  PRICE_OVERRIDE = 'PRICE_OVERRIDE',
  DISCOUNT_APPLIED = 'DISCOUNT_APPLIED',

  // Returns
  RETURN_CREATED = 'RETURN_CREATED',
  RETURN_APPROVED = 'RETURN_APPROVED',
  RETURN_REJECTED = 'RETURN_REJECTED',

  // Inventory
  INVENTORY_ADJUSTED = 'INVENTORY_ADJUSTED',
  STOCK_DECREASED = 'STOCK_DECREASED',
  STOCK_INCREASED = 'STOCK_INCREASED',

  // Payments
  PAYMENT_RECORDED = 'PAYMENT_RECORDED',
  DEBT_PAYMENT = 'DEBT_PAYMENT',
  DEBT_CANCELLED = "DEBT_CANCELLED",
}

export enum AuditEntity {
  USER = 'USER',
  PRODUCT = 'PRODUCT',
  CATEGORY = 'CATEGORY',
  SALE = 'SALE',
  SALE_ITEM = 'SALE_ITEM',
  PAYMENT = 'PAYMENT',
  DEBT = 'DEBT',
  RETURN = 'RETURN',
  INVENTORY = 'INVENTORY',
  AUTH = 'AUTH',
}

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  @Index()
  userId?: string | null;

  @Column({ type: 'varchar', length: 60 })
  @Index()
  action!: AuditAction;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  entity!: AuditEntity;

  @Column({ type: 'uuid', nullable: true, name: 'entity_id' })
  entityId?: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'before_snapshot' })
  beforeSnapshot?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'after_snapshot' })
  afterSnapshot?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'inet', nullable: true, name: 'ip_address' })
  ipAddress?: string | null;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt!: Date;

  // Relations
  @ManyToOne(() => UserEntity, (user) => user.auditLogs, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;
}