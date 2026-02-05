// ============================================================
// src/common/common.module.ts
// ============================================================
import { Global, Module } from '@nestjs/common';
import { RedisService } from './config/redis.config';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AuditLogEntity } from '../audit-logs/entities/audit-log.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [RedisService, AuditLogService],
  exports: [RedisService, AuditLogService],
})
export class CommonModule {}