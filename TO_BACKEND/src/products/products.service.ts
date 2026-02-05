// ============================================================
// src/products/products.service.ts - WITH IMAGE HANDLING
// ============================================================
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { ImageService } from './services/image.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/entities/audit-log.entity';
import { ProductQueryDto } from 'src/common/dto/pagination.query.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    private readonly imageService: ImageService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    dto: CreateProductDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ): Promise<ProductEntity> {
    const existing = await this.productRepository.findOne({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Product with this name already exists');
    }

    if (dto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    let imageUrl: string | null = null;
    if (file) {
      const filename = await this.imageService.processUpload(file);
      imageUrl = this.imageService.getImageUrl(filename);
    }

    const product = this.productRepository.create({
      ...dto,
      imageUrl,
      stockQuantity: dto.stockQuantity || 0,
      minStockLimit: dto.minStockLimit || 0,
    });

    const saved = await this.productRepository.save(product);

    await this.auditLogService.log({
      userId,
      action: AuditAction.CREATED,
      entity: AuditEntity.PRODUCT,
      entityId: saved.id,
      afterSnapshot: { name: saved.name, hasImage: !!imageUrl },
    });

    return this.findOne(saved.id);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const beforeSnapshot = { name: product.name, imageUrl: product.imageUrl };

    if (dto.name && dto.name !== product.name) {
      const existing = await this.productRepository.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException('Product with this name already exists');
      }
    }

    if (dto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    if (file) {
      const oldImageUrl = product.imageUrl;
      const oldFilename = oldImageUrl ? oldImageUrl.split('/').pop() : null;
      
      const newFilename = await this.imageService.replaceImage(oldFilename || null, file);
      product.imageUrl = this.imageService.getImageUrl(newFilename);
    }

    Object.assign(product, dto);
    const saved = await this.productRepository.save(product);

    await this.auditLogService.log({
      userId,
      action: AuditAction.UPDATED,
      entity: AuditEntity.PRODUCT,
      entityId: saved.id,
      beforeSnapshot,
      afterSnapshot: { name: saved.name, imageUrl: saved.imageUrl },
      metadata: { imageUpdated: !!file },
    });

    return this.findOne(saved.id);
  }

  async findAll(
  queryDto: ProductQueryDto,
): Promise<PaginatedResponseDto<ProductEntity>> {

  const { page = 1, limit = 20, search } = queryDto;

  const query = this.productRepository
    .createQueryBuilder('product')
    .leftJoinAndSelect('product.category', 'category')
    .where('product.deleted_at IS NULL')
    .orderBy('product.created_at', 'DESC');

  if (search) {
    query.andWhere('product.name ILIKE :search', {
      search: `%${search}%`,
    });
  }

  const [products, total] = await query
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return PaginatedResponseDto.create(products, total, page, limit);
}

  async findOne(id: string): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async getLowStock(threshold?: number): Promise<ProductEntity[]> {
    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.deleted_at IS NULL');

    if (threshold !== undefined) {
      query.andWhere('product.stock_quantity <= :threshold', { threshold });
    } else {
      query.andWhere('product.stock_quantity <= product.min_stock_limit');
    }

    return query.orderBy('product.stock_quantity', 'ASC').getMany();
  }

  async softDelete(id: string, userId: string): Promise<ProductEntity> {
    const product = await this.findOne(id);

    if (product.imageUrl) {
      const filename = product.imageUrl.split('/').pop();
      await this.imageService.deleteFile(filename || null).catch(() => {});
    }

    product.deletedAt = new Date();
    const saved = await this.productRepository.save(product);

    await this.auditLogService.log({
      userId,
      action: AuditAction.DELETED,
      entity: AuditEntity.PRODUCT,
      entityId: saved.id,
      beforeSnapshot: { name: product.name },
      afterSnapshot: { deletedAt: saved.deletedAt },
    });

    return saved;
  }

  async restore(id: string, userId: string): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.deletedAt) {
      throw new BadRequestException('Product is not deleted');
    }

    product.deletedAt = null;
    const saved = await this.productRepository.save(product);

    await this.auditLogService.log({
      userId,
      action: AuditAction.RESTORED,
      entity: AuditEntity.PRODUCT,
      entityId: saved.id,
      afterSnapshot: { name: product.name },
    });

    return this.findOne(saved.id);
  }

  async cleanupOrphanedImages(): Promise<number> {
    const products = await this.productRepository.find({ select: ['imageUrl'] });

    const activeFilenames = products
      .map((p) => p.imageUrl?.split('/').pop())
      .filter((f): f is string => !!f);

    return this.imageService.cleanupOrphanedImages(activeFilenames);
  }

  async deleteImage(id: string, userId: string): Promise<ProductEntity> {
    const product = await this.findOne(id);

    if (!product.imageUrl) {
      throw new BadRequestException('Product has no image');
    }

    const filename = product.imageUrl.split('/').pop();
    await this.imageService.deleteFile(filename || null);

    product.imageUrl = null;
    const saved = await this.productRepository.save(product);

    await this.auditLogService.log({
      userId,
      action: AuditAction.UPDATED,
      entity: AuditEntity.PRODUCT,
      entityId: saved.id,
      beforeSnapshot: { imageUrl: product.imageUrl },
      afterSnapshot: { imageUrl: null },
    });

    return saved;
  }
}