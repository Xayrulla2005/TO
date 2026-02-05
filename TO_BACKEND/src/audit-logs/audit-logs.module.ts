import { Module as Mod2 } from '@nestjs/common';
import { TypeOrmModule as TO2 } from '@nestjs/typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditLogService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';

@Mod2({
  imports: [TO2.forFeature([AuditLogEntity])],
  providers: [AuditLogService],
  controllers: [AuditLogsController],
  exports: [AuditLogService],
})
export class AuditLogsModule {}