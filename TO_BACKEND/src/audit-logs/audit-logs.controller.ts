// ============================================================
// src/audit-logs/audit-logs.controller.ts
// ============================================================
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { AuditEntity } from './entities/audit-log.entity';
import { AuditLogService } from './audit-logs.service';

@ApiTags('Audit Logs')
@Controller('api/v1/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Get all audit logs (ADMIN, paginated)' })
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.auditLogService.findAll(
      parseInt(page || '1', 10),
      parseInt(limit || '50', 10),
    );
  }

  @Get('by-entity/:entity')
  @ApiOperation({ summary: 'Get audit logs by entity type (ADMIN)' })
  async findByEntity(
    @Query('entity') entity: AuditEntity,
    @Query('entityId') entityId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.findByEntity(
      entity,
      entityId,
      parseInt(page || '1', 10),
      parseInt(limit || '50', 10),
    );
  }

  @Get('by-user/:userId')
  @ApiOperation({ summary: 'Get audit logs by user (ADMIN)' })
  async findByUser(
    @Query('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.findByUserId(
      userId,
      parseInt(page || '1', 10),
      parseInt(limit || '50', 10),
    );
  }
}