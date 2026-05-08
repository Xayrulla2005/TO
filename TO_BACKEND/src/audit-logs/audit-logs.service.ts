// src/audit-logs/audit-logs.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import {
  AuditLogEntity,
  AuditAction,
  AuditEntity,
} from './entities/audit-log.entity';

export interface CreateAuditLogDto {
  userId?:         string | null;
  action:          AuditAction;
  entity:          AuditEntity;
  entityId?:       string | null;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?:  Record<string, unknown> | null;
  metadata?:       Record<string, unknown> | null;
  ipAddress?:      string | null;
  userAgent?:      string | null;
}

export interface FindAllParams {
  page?:   number;
  limit?:  number;
  search?: string;
  action?: string;
  entity?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repository: Repository<AuditLogEntity>,
  ) {}

  // ─── Log yozish ───────────────────────────────────────────
  async log(data: CreateAuditLogDto): Promise<AuditLogEntity> {
    const auditLog = this.repository.create({
      userId:         data.userId         ?? null,
      action:         data.action,
      entity:         data.entity,
      entityId:       data.entityId       ?? null,
      beforeSnapshot: data.beforeSnapshot ?? null,
      afterSnapshot:  data.afterSnapshot  ?? null,
      metadata:       data.metadata       ?? null,
      ipAddress:      data.ipAddress      ?? null,
      userAgent:      data.userAgent      ?? null,
    });
    return this.repository.save(auditLog);
  }

  // ─── Barcha loglar (action + search filter bilan) ─────────
  async findAll(params: FindAllParams = {}): Promise<{
    data: AuditLogEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(100, params.limit ?? 50);

    const qb = this.repository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // ✅ Action filter — vergul bilan bir nechta action bo'lishi mumkin
    // Masalan: action=SALE_COMPLETED,SALE_CANCELLED
    if (params.action) {
      const actions = params.action.split(',').map(a => a.trim()).filter(Boolean);
      if (actions.length === 1) {
        qb.andWhere('log.action = :action', { action: actions[0] });
      } else if (actions.length > 1) {
        qb.andWhere('log.action IN (:...actions)', { actions });
      }
    }

    // ✅ Entity filter
    if (params.entity) {
      qb.andWhere('log.entity = :entity', { entity: params.entity });
    }

    // ✅ Search — afterSnapshot ichidagi saleNumber, customerName bo'yicha
    if (params.search?.trim()) {
      const s = `%${params.search.trim()}%`;
      qb.andWhere(
        `(
          log.afterSnapshot::text ILIKE :s OR
          log.metadata::text     ILIKE :s
        )`,
        { s },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  // ─── User bo'yicha ────────────────────────────────────────
  async findByUserId(
    userId: string,
    page  = 1,
    limit = 20,
  ): Promise<{ data: AuditLogEntity[]; total: number }> {
    const [data, total] = await this.repository.findAndCount({
      where:    { userId },
      order:    { createdAt: 'DESC' },
      skip:     (page - 1) * limit,
      take:     limit,
      relations:['user'],
    });
    return { data, total };
  }

  // ─── Entity bo'yicha ──────────────────────────────────────
  async findByEntity(
    entity:   AuditEntity,
    entityId?: string,
    page     = 1,
    limit    = 20,
  ): Promise<{ data: AuditLogEntity[]; total: number }> {
    const where: FindOptionsWhere<AuditLogEntity> = { entity };
    if (entityId) where.entityId = entityId;

    const [data, total] = await this.repository.findAndCount({
      where,
      order:    { createdAt: 'DESC' },
      skip:     (page - 1) * limit,
      take:     limit,
      relations:['user'],
    });
    return { data, total };
  }
}