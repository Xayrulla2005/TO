import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserRole } from '../../common/dto/roles.enum';
import { SaleEntity } from '../../sale/entities/sale.entity';
import { AuditLogEntity } from '../../audit-logs/entities/audit-log.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  username!: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  @Index()
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  @Exclude({ toPlainOnly: true }) // Never serialize password
  password!: string;

  @Column({ type: 'varchar', length: 50, default: UserRole.SALER })
  role!: UserRole;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', nullable: true })
  @Exclude({ toPlainOnly: true }) // Never serialize refresh token
  refreshToken?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastLoginAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date | null;

  // Relations
  @OneToMany(() => SaleEntity, (sale) => sale.createdBy)
  sales?: SaleEntity[];

  @OneToMany(() => AuditLogEntity, (log) => log.user)
  auditLogs?: AuditLogEntity[];

  // Computed helper
  get fullName(): string {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim() || this.username;
  }
}
