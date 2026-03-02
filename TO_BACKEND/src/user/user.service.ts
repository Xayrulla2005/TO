import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { UserEntity } from './entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
} from './dto/create-user.dto';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../common/dto/pagination.dto';

import { AuditLogService } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  AuditEntity,
} from '../audit-logs/entities/audit-log.entity';
import { UserRole } from '../common/dto/roles.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
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
  // Phone bo'yicha tekshirish
  const existingUser = await this.userRepository.findOne({
    where: { phone: dto.phone },
    withDeleted: true,
  });

  if (existingUser) {
    throw new ConflictException('Bu telefon raqami bilan foydalanuvchi mavjud');
  }

  const hashedPassword = await bcrypt.hash(dto.password, 12);

  const user = await this.userRepository.save(
    this.userRepository.create({
      fullName: dto.fullName, // fullName ni username sifatida saqlaymiz
      phone: dto.phone,
      password: hashedPassword,
      role: dto.role || UserRole.SALER,
      isActive: dto.isActive ?? true,
    }),
  );

  await this.auditLogService.log({
    userId: adminId,
    action: AuditAction.CREATED,
    entity: AuditEntity.USER,
    entityId: user.id,
    afterSnapshot: {
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
    },
  });

  return UserResponseDto.fromEntity(user);
}

  async update(
  id: string,
  dto: UpdateUserDto,
  adminId: string,
): Promise<UserResponseDto> {
  const user = await this.userRepository.findOne({ where: { id } });
  if (!user) throw new NotFoundException('User not found');

  const before = UserResponseDto.fromEntity(user);

  // Phone unique bo'lgani uchun tekshirish
  if (dto.phone && dto.phone !== user.phone) {
    const existingUser = await this.userRepository.findOne({
      where: { phone: dto.phone },
      withDeleted: true,
    });

    if (existingUser) {
      throw new ConflictException('Bu telefon raqami band');
    }
  }

  // Password ni alohida qayta ishlash
  const updateData: any = {};
  
  if (dto.fullName) updateData.username = dto.fullName;
  if (dto.phone) updateData.phone = dto.phone;
  if (dto.role) updateData.role = dto.role;
  if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
  
  // Password update (ixtiyoriy)
  if (dto.password) {
    updateData.password = await bcrypt.hash(dto.password, 12);
  }

  await this.userRepository.update(id, updateData);

  const updated = await this.userRepository.findOne({ where: { id } });
  if (!updated) throw new NotFoundException('User not found after update');

  await this.auditLogService.log({
    userId: adminId,
    action: AuditAction.UPDATED,
    entity: AuditEntity.USER,
    entityId: id,
    beforeSnapshot: before as any,
    afterSnapshot: UserResponseDto.fromEntity(updated) as any,
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
      beforeSnapshot: UserResponseDto.fromEntity(user) as any,
    });
  }

  async restore(id: string, adminId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
      withDeleted: true,
    });

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
