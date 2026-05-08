// path: src/modules/customers/customers.controller.ts

import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { UserRole } from '../common/dto/roles.enum';

@ApiTags('Customers')
@Controller('api/v1/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Barcha mijozlar (qidirish va pagination bilan)' })
  @ApiQuery({ name: 'search', required: false, description: 'Ism yoki telefon bo\'yicha qidiruv' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  findAll(
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    // Service-da pagination qo'shganimiz sababli parametrlarni uzatamiz
    return this.service.findAll(search, +page, +limit);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Bitta mijozni ID bo\'yicha olish' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    // ParseUUIDPipe orqali noto'g'ri formatdagi ID-larni bazaga yubormasdan to'xtatamiz
    return this.service.findOne(id);
  }

  @Get(':id/sales')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Mijozning muvaffaqiyatli savdo tarixi' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  getSales(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.service.getSalesHistory(id, +page, +limit);
  }

  @Get(':id/stats')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Mijozning umumiy statistikasi va qarzdorligi' })
  getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getStats(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi mijoz qo\'shish' })
  @ApiResponse({ status: 201, description: 'Mijoz muvaffaqiyatli yaratildi' })
  @ApiResponse({ status: 409, description: 'Telefon raqam allaqachon mavjud' })
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Mijoz ma\'lumotlarini tahrirlash' })
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() dto: UpdateCustomerDto
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mijozni o\'chirish (Faqat Admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}