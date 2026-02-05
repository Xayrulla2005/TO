import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from './entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/entities/audit-log.entity';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<CategoryEntity>> {
    const { page = 1, limit = 20 } = pagination;
    const [categories, total] = await this.categoryRepository.findAndCount({
      relations: ['parent', 'children'],
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return PaginatedResponseDto.create(categories, total, page, limit);
  }

  async findById(id: string): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children', 'products'],
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto, adminId: string): Promise<CategoryEntity> {
    const existing = await this.categoryRepository.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Category name already exists');

    if (dto.parentId) {
      const parent = await this.categoryRepository.findOne({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const category = await this.categoryRepository.save(
      this.categoryRepository.create({
        name: dto.name,
        description: dto.description || null,
        color: dto.color || null,
        parentId: dto.parentId || null,
      }),
    );

    await this.auditLogService.log({
      userId: adminId,
      action: AuditAction.CREATED,
      entity: AuditEntity.CATEGORY,
      entityId: category.id,
      afterSnapshot: { name: category.name, parentId: category.parentId },
    });

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, adminId: string): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    const before = { ...category };

    if (dto.name && dto.name !== category.name) {
      const existing = await this.categoryRepository.findOne({ where: { name: dto.name } });
      if (existing) throw new ConflictException('Category name already exists');
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) throw new ConflictException('A category cannot be its own parent');
      const parent = await this.categoryRepository.findOne({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const updates: Partial<CategoryEntity> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.color !== undefined) updates.color = dto.color;
    if (dto.parentId !== undefined) updates.parentId = dto.parentId;

    await this.categoryRepository.update(id, updates);
    const updated = await this.categoryRepository.findOne({ where: { id }, relations: ['parent', 'children'] });
    if (!updated) throw new NotFoundException('Update failed');

    await this.auditLogService.log({
      userId: adminId,
      action: AuditAction.UPDATED,
      entity: AuditEntity.CATEGORY,
      entityId: id,
      beforeSnapshot: { name: before.name, parentId: before.parentId } as Record<string, unknown>,
      afterSnapshot: { name: updated.name, parentId: updated.parentId } as Record<string, unknown>,
    });

    return updated;
  }

  async softDelete(id: string, adminId: string): Promise<void> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    await this.categoryRepository.softDelete(id);

    await this.auditLogService.log({
      userId: adminId,
      action: AuditAction.DELETED,
      entity: AuditEntity.CATEGORY,
      entityId: id,
    });
  }

  async restore(id: string, adminId: string): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findOne({ where: { id }, withDeleted: true });
    if (!category) throw new NotFoundException('Category not found');

    await this.categoryRepository.restore(id);
    const restored = await this.categoryRepository.findOne({ where: { id } });
    if (!restored) throw new NotFoundException('Restore failed');

    await this.auditLogService.log({
      userId: adminId,
      action: AuditAction.RESTORED,
      entity: AuditEntity.CATEGORY,
      entityId: id,
    });

    return restored;
  }
}
