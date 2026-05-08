// src/audit-logs/audit-logs.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  @ApiQuery({ name: 'page',   required: false })
  @ApiQuery({ name: 'limit',  required: false })
  @ApiQuery({ name: 'action', required: false, description: 'e.g. SALE_COMPLETED or SALE_COMPLETED,SALE_CANCELLED' })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('search') search?: string,
  ) {
    return this.auditLogService.findAll({
      page:   parseInt(page  || '1',  10),
      limit:  parseInt(limit || '50', 10),
      action,
      entity,
      search,
    });
  }

  @Get('by-entity')
  @ApiOperation({ summary: 'Get audit logs by entity type (ADMIN)' })
  async findByEntity(
    @Query('entity')   entity:    AuditEntity,
    @Query('entityId') entityId?: string,
    @Query('page')     page?:     string,
    @Query('limit')    limit?:    string,
  ) {
    return this.auditLogService.findByEntity(
      entity,
      entityId,
      parseInt(page  || '1',  10),
      parseInt(limit || '50', 10),
    );
  }

  @Get('by-user')
  @ApiOperation({ summary: 'Get audit logs by user (ADMIN)' })
  async findByUser(
    @Query('userId') userId: string,
    @Query('page')   page?:  string,
    @Query('limit')  limit?: string,
  ) {
    return this.auditLogService.findByUserId(
      userId,
      parseInt(page  || '1',  10),
      parseInt(limit || '50', 10),
    );
  }
}