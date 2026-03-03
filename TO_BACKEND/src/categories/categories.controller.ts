import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
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
import { CategoriesService } from './categories.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { Unique } from 'typeorm';

@ApiTags('Categories')
@Unique(['name'])
@Controller('api/v1/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ✅ FIX 1: GET barcha rolelar uchun (CASHIER ham kategoriyani ko'rishi kerak - Sales sahifasi uchun)
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'List categories' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.categoriesService.findAll(pagination);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Get category by ID' })
  async findById(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create category (ADMIN)' })
  async create(@Body() dto: CreateCategoryDto, @CurrentUser() admin: UserEntity) {
    return this.categoriesService.create(dto, admin.id);
  }

  // ✅ FIX 2: @Put + @Patch ikkalasi ham ishlaydi (frontend patch yuborsa ham, put yuborsa ham)
  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update category (ADMIN)' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() admin: UserEntity) {
    return this.categoriesService.update(id, dto, admin.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update category PATCH (ADMIN)' })
  async updatePatch(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() admin: UserEntity) {
    return this.categoriesService.update(id, dto, admin.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete category (ADMIN)' })
  async softDelete(@Param('id') id: string, @CurrentUser() admin: UserEntity) {
    return this.categoriesService.softDelete(id, admin.id);
  }

  @Post(':id/restore')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore category (ADMIN)' })
  async restore(@Param('id') id: string, @CurrentUser() admin: UserEntity) {
    return this.categoriesService.restore(id, admin.id);
  }
}