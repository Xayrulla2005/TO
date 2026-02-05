import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { CurrentUser } from '../common/decarators/current.user.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { UserEntity } from '../user/entities/user.entity';
import { CategoriesService } from './categories.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

@ApiTags('Categories')
@Controller('api/v1/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List categories (ADMIN)' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.categoriesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID (ADMIN)' })
  async findById(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create category (ADMIN)' })
  async create(@Body() dto: CreateCategoryDto, @CurrentUser() admin: UserEntity) {
    return this.categoriesService.create(dto, admin.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update category (ADMIN)' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() admin: UserEntity) {
    return this.categoriesService.update(id, dto, admin.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete category (ADMIN)' })
  async softDelete(@Param('id') id: string, @CurrentUser() admin: UserEntity) {
    return this.categoriesService.softDelete(id, admin.id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore category (ADMIN)' })
  async restore(@Param('id') id: string, @CurrentUser() admin: UserEntity) {
    return this.categoriesService.restore(id, admin.id);
  }
}
