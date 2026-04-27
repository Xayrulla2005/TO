// ============================================================
// src/returns/returns.controller.ts
// ============================================================
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { CurrentUser } from '../common/decarators/current.user.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { UserEntity } from '../user/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ReturnsService } from './return.service';
import { ApproveReturnDto, CreateReturnDto, RejectReturnDto } from './dto/create-return.dto';

@ApiTags('Returns')
@Controller('api/v1/returns')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a return request' })
  async create(@Body() dto: CreateReturnDto, @CurrentUser() user: UserEntity) {
    return this.returnsService.createReturn(dto, user.id);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve return (ADMIN). Restores inventory.' })
  async approve(
    @Param('id') returnId: string,
    @Body() dto: ApproveReturnDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.returnsService.approveReturn(returnId, dto, user.id);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject return (ADMIN)' })
  async reject(
    @Param('id') returnId: string,
    @Body() dto: RejectReturnDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.returnsService.rejectReturn(returnId, dto, user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List returns (ADMIN)' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.returnsService.findAll(pagination);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get return details (ADMIN)' })
  async findById(@Param('id') returnId: string) {
    return this.returnsService.findById(returnId);
  }
}