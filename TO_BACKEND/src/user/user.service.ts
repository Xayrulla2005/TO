// ============================================================
// src/users/users.service.ts
// ============================================================
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/create-user.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/entities/audit-log.entity';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
const newEmail = 'test@example.com';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<UserResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
    const [users, total] = await this.userRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = users.map(UserResponseDto.fromEntity);
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return UserResponseDto.fromEntity(user);
  }

  async create(dto: CreateUserDto, adminId: string): Promise<UserResponseDto> {
    // Check uniqueness
    const existingUsername = await this.userRepository.findOne({ where: { username: dto.username }, withDeleted: true });
    if (existingUsername) throw new ConflictException('Username already exists');

    const existingEmail = await this.userRepository.findOne({ where: { email: dto.email }, withDeleted: true });
    if (existingEmail) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.userRepository.save(
      this.userRepository.create({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName || null,
        lastName: dto.lastName || null,
        role: dto.role || 'SALER' as any,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      }),
    );

    await this.auditLogService.log({
      userId: adminId,
      action: AuditAction.CREATED,
      entity: AuditEntity.USER,
      entityId: user.id,
      afterSnapshot: { username: user.username, email: user.email, role: user.role },
    });

    return UserResponseDto.fromEntity(user);
  }

  async update(id: string, dto: UpdateUserDto, adminId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const before = UserResponseDto.fromEntity(user);

    if (dto.username && dto.username !== user.username) {
      const existing = await this.userRepository.findOne({ where: { username: dto.username }, withDeleted: true });
      if (existing) throw new ConflictException('Username already exists');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: dto.email }, withDeleted: true });
      if (existing) throw new ConflictException('Email already in use');
    }

    await this.userRepository.update(id, {
  email: newEmail,
});

    const updates: QueryDeepPartialEntity<UserEntity> = {
  email: newEmail,
  isActive: false,
  lastLoginAt: new Date(),
};
    
    await this.userRepository.update(id, updates);
    const updated = await this.userRepository.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('User not found after update');

    await this.auditLogService.log({
      userId: adminId,
      action: AuditAction.UPDATED,
      entity: AuditEntity.USER,
      entityId: id,
      beforeSnapshot: before as unknown as Record<string, unknown>,
      afterSnapshot: UserResponseDto.fromEntity(updated) as unknown as Record<string, unknown>,
    });

    return UserResponseDto.fromEntity(updated);
  }

  async softDelete(id: string, adminId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.userRepository.softDelete(id);

    await this.auditLogService.log({
      userId: adminId,
      action: AuditAction.DELETED,
      entity: AuditEntity.USER,
      entityId: id,
      beforeSnapshot: UserResponseDto.fromEntity(user) as unknown as Record<string, unknown>,
    });
  }

  async restore(id: string, adminId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id }, withDeleted: true });
    if (!user) throw new NotFoundException('User not found');
    if (!user.deletedAt) throw new ConflictException('User is not deleted');

    await this.userRepository.restore(id);
    const restored = await this.userRepository.findOne({ where: { id } });
    if (!restored) throw new NotFoundException('Restore failed');

    await this.auditLogService.log({
      userId: adminId,
      action: AuditAction.RESTORED,
      entity: AuditEntity.USER,
      entityId: id,
    });

    return UserResponseDto.fromEntity(restored);
  }
}

