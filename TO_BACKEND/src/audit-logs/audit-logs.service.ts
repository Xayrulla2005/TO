// ============================================================
// src/audit-logs/audit-logs.service.ts
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity, AuditAction, AuditEntity } from './entities/audit-log.entity';
import { FindOptionsWhere } from 'typeorm';

export interface CreateAuditLogDto {
  userId?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// Frontend tablariga mos action guruhlari
const ACTION_GROUPS: Record<string, AuditAction[]> = {
  SALE_COMPLETED: [AuditAction.SALE_COMPLETED],
  DEBT_PAYMENT:   [AuditAction.DEBT_PAYMENT],
  SALE_RETURNED:  [
    AuditAction.RETURN_CREATED,
    AuditAction.RETURN_APPROVED,
    AuditAction.RETURN_REJECTED,
    // agar SALE_RETURNED enum bo'lsa ham qo'shamiz
  ],
  STOCK_ADJUSTED: [
    AuditAction.INVENTORY_ADJUSTED,
    AuditAction.STOCK_DECREASED,
    AuditAction.STOCK_INCREASED,
  ],
  USER_CREATED: [
    AuditAction.LOGIN,
    AuditAction.LOGOUT,
    AuditAction.CREATED,
    AuditAction.UPDATED,
    AuditAction.DELETED,
    AuditAction.PASSWORD_CHANGED,
  ],
};

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repository: Repository<AuditLogEntity>,
  ) {}

  async log(data: CreateAuditLogDto): Promise<AuditLogEntity> {
    const auditLog = this.repository.create({
      userId: data.userId ?? null,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId ?? null,
      beforeSnapshot: data.beforeSnapshot ?? null,
      afterSnapshot: data.afterSnapshot ?? null,
      metadata: data.metadata ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
    });
    return this.repository.save(auditLog);
  }

  async findAll(
    page = 1,
    limit = 50,
    action?: string,
    search?: string,
  ): Promise<{ data: AuditLogEntity[]; total: number }> {
    const qb = this.repository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // action filtri — group yoki aniq action
    if (action && action !== 'all') {
      const group = ACTION_GROUPS[action];
      if (group && group.length > 0) {
        // Guruh filtri (masalan STOCK_ADJUSTED → 3 ta action)
        qb.andWhere('log.action IN (:...actions)', { actions: group });
      } else {
        // Aniq action (masalan SALE_COMPLETED)
        qb.andWhere('log.action = :action', { action });
      }
    }

    // search — mijoz ismi yoki savdo raqami bo'yicha (snapshot ichidan)
    if (search) {
      qb.andWhere(
        `(
          log.after_snapshot::text ILIKE :search
          OR log.metadata::text ILIKE :search
        )`,
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findByUserId(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: AuditLogEntity[]; total: number }> {
    const [data, total] = await this.repository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findByEntity(
    entity: AuditEntity,
    entityId?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: AuditLogEntity[]; total: number }> {
    const where: FindOptionsWhere<AuditLogEntity> = { entity };
    if (entityId) where.entityId = entityId;

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}