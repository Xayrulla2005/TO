// ============================================================
// src/returns/returns.controller.ts
// ============================================================
import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Param, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { CurrentUser } from '../common/decarators/current.user.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { UserEntity } from '../user/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ReturnsService } from './return.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import express from 'express';

@ApiTags('Returns')
@Controller('api/v1/returns')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  // ── Qaytarish yaratish — ADMIN & SALER ──
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a return request' })
  async create(@Body() dto: CreateReturnDto, @CurrentUser() user: UserEntity) {
    return this.returnsService.createReturn(dto, user.id);
  }

  // ── Tasdiqlash — ADMIN ──
  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve return (ADMIN). Restores inventory.' })
  async approve(@Param('id') returnId: string, @CurrentUser() user: UserEntity) {
    return this.returnsService.approveReturn(returnId, user.id);
  }

  // ── Rad etish — ADMIN ──
  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject return (ADMIN)' })
  async reject(
    @Param('id') returnId: string,
    @Body() dto: UpdateReturnDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.returnsService.rejectReturn(returnId, dto, user.id);
  }

  // ── Ro'yxat — status filter alohida, PaginationDto ga kirmaydi ──
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'List returns' })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  async findAll(
    @Query('page')   page   = 1,
    @Query('limit')  limit  = 20,
    @Query('status') status?: string,
  ) {
    return this.returnsService.findAll({ page: +page, limit: +limit }, status);
  }

  // ── Bitta qaytarish ──
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Get return details' })
  async findById(@Param('id') returnId: string) {
    return this.returnsService.findById(returnId);
  }

  // ── Chek ──
  @Get(':id/receipt')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Get return receipt PDF' })
  async getReceipt(@Param('id') returnId: string, @Res() res: express.Response) {
    return this.returnsService.generateReceipt(returnId, res);
  }
}