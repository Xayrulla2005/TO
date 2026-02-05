// ============================================================
// src/products/products.controller.ts - COMPLETE
// ============================================================
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { CurrentUser } from '../common/decarators/current.user.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { multerOptions, UPLOAD_CONFIG } from './config/multer.config';

@ApiTags('Products')
@Controller('api/v1/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image', multerOptions))
  @ApiOperation({ summary: 'Create product with optional image (ADMIN)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'purchasePrice', 'salePrice', 'unit'],
      properties: {
        name: { type: 'string' },
        categoryId: { type: 'string', format: 'uuid' },
        purchasePrice: { type: 'number' },
        salePrice: { type: 'number' },
        unit: { type: 'string' },
        stockQuantity: { type: 'number' },
        minStockLimit: { type: 'number' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  async create(
    @Body() dto: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.productsService.create(dto, file, userId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image', multerOptions))
  @ApiOperation({ summary: 'Update product with optional image (ADMIN)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        categoryId: { type: 'string', format: 'uuid' },
        purchasePrice: { type: 'number' },
        salePrice: { type: 'number' },
        unit: { type: 'string' },
        stockQuantity: { type: 'number' },
        minStockLimit: { type: 'number' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.productsService.update(id, dto, file, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all products' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.productsService.findAll(pagination);
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get low stock products (ADMIN)' })
  async getLowStock(@Query('threshold') threshold?: string) {
    const numThreshold = threshold ? parseInt(threshold, 10) : undefined;
    return this.productsService.getLowStock(numThreshold);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete product (ADMIN)' })
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.productsService.softDelete(id, userId);
  }

  @Post(':id/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Restore product (ADMIN)' })
  async restore(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.productsService.restore(id, userId);
  }

  @Delete(':id/image')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete product image (ADMIN)' })
  async deleteImage(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.productsService.deleteImage(id, userId);
  }

  @Post('cleanup-images')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cleanup orphaned images (ADMIN)' })
  async cleanupImages() {
    const deletedCount = await this.productsService.cleanupOrphanedImages();
    return { deletedCount, message: `${deletedCount} orphaned images deleted` };
  }
}