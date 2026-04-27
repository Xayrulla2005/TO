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

  async findByUserId(userId: string, page = 1, limit = 20): Promise<{ data: AuditLogEntity[]; total: number }> {
    const [data, total] = await this.repository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findByEntity(entity: AuditEntity, entityId?: string, page = 1, limit = 20): Promise<{ data: AuditLogEntity[]; total: number }> {
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

  async findAll(page = 1, limit = 50): Promise<{ data: AuditLogEntity[]; total: number }> {
    const [data, total] = await this.repository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['user'],
    });
    return { data, total };
  }
}
