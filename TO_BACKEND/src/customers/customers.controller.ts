import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
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

  // ── GET /customers?search=xxx ─────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Barcha mijozlar (qidirish bilan)' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }

  // ── GET /customers/:id ────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Bitta mijoz' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ── GET /customers/:id/sales ──────────────────────────────
  @Get(':id/sales')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Mijoz savdo tarixi' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSales(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.getSalesHistory(id, +page, +limit);
  }

  // ── GET /customers/:id/stats ──────────────────────────────
  @Get(':id/stats')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Mijoz statistikasi' })
  getStats(@Param('id') id: string) {
    return this.service.getStats(id);
  }

  // ── POST /customers ───────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi mijoz qo\'shish' })
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  // ── PUT /customers/:id ────────────────────────────────────
  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Mijozni yangilash' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(id, dto);
  }

  // ── DELETE /customers/:id ─────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mijozni o\'chirish (faqat ADMIN)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}