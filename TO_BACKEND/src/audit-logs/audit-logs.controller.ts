// ============================================================
// src/audit-logs/audit-logs.controller.ts
// ============================================================
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { AuditAction, AuditEntity } from './entities/audit-log.entity';
import { AuditLogService } from './audit-logs.service';

@ApiTags('Audit Logs')
@Controller('api/v1/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SALER)
@ApiBearerAuth()
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Get all audit logs (paginated, filterable by action)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction, description: 'Filter by action type' })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    return this.auditLogService.findAll(
      parseInt(page || '1', 10),
      parseInt(limit || '50', 10),
      action || undefined,
      search || undefined,
    );
  }

  @Get('by-entity/:entity')
  @ApiOperation({ summary: 'Get audit logs by entity type' })
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
  @ApiOperation({ summary: 'Get audit logs by user' })
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