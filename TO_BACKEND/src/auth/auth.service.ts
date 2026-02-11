import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { config } from 'dotenv';

import { UserEntity } from '../user/entities/user.entity';
import { LoginDto } from './dto/login.auth.dto';
import { RegisterDto } from './dto/register.auth.dto';
import { ChangePasswordDto } from './dto/change.password.dto';
import { AuthResponseDto } from './dto/auth.response.dto';

import { RedisService } from '../common/config/redis.config';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/entities/audit-log.entity';

import { UserRole } from '../common/dto/roles.enum';
import { JwtPayload } from './jwt.strategy';

config();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
const ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly redisService: RedisService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── Password Validation ────────────────────────────────
  private validatePasswordStrength(password: string): void {
    if (password.length < 6) {
      throw new BadRequestException('Parol kamida 6 belgidan iborat bo\'lishi kerak');
    }
  }

  // ─── Token Generation ───────────────────────────────────
  private generateAccessToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.fullName,
      role: user.role,
    } as any;

    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRATION });
  }

  private generateRefreshToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.fullName,
      role: user.role,
    } as any;

    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRATION });
  }

  private getAccessTokenExpiresInSeconds(): number {
    const exp = ACCESS_EXPIRATION;
    if (exp.endsWith('m')) return parseInt(exp, 10) * 60;
    if (exp.endsWith('h')) return parseInt(exp, 10) * 3600;
    if (exp.endsWith('s')) return parseInt(exp, 10);
    return 900;
  }

  private getRefreshTokenExpiresInSeconds(): number {
    const exp = REFRESH_EXPIRATION;
    if (exp.endsWith('d')) return parseInt(exp, 10) * 86400;
    if (exp.endsWith('h')) return parseInt(exp, 10) * 3600;
    return 604800;
  }

  // ─── Build Auth Response ────────────────────────────────
  private buildAuthResponse(user: UserEntity, accessToken: string): AuthResponseDto {
    return {
      accessToken,
      expiresIn: this.getAccessTokenExpiresInSeconds(),
      user: {
        id: user.id,
        username: user.fullName,
        role: user.role,
        isActive: user.isActive,
      } as any,
    };
  }

  // ─── Register (ADMIN only) ──────────────────────────────
  async register(
    dto: RegisterDto,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    this.validatePasswordStrength(dto.password);

    // ✅ PHONE bo'yicha tekshirish (phone unique)
    const existingUser = await this.userRepository.findOne({
      where: { phone: dto.phone },
      withDeleted: true,
    });

    if (existingUser) {
      throw new ConflictException('Bu telefon raqami bilan foydalanuvchi mavjud');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.userRepository.save(
      this.userRepository.create({
        fullName: dto.fullName, // ✅ TO'G'RI
        phone: dto.phone,        // ✅ QOSHILDI
        password: hashedPassword,
        role: dto.role || UserRole.SALER,
        isActive: dto.isActive ?? true,
        refreshToken: null,
        lastLoginAt: new Date(),
      }),
    );

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    const hashedRefresh = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id, { refreshToken: hashedRefresh });

    await this.redisService.set(
      `refresh:${user.id}`,
      'active',
      this.getRefreshTokenExpiresInSeconds(),
    );

    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.CREATED,
      entity: AuditEntity.USER,
      entityId: user.id,
      afterSnapshot: {
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
      },
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    return {
      ...this.buildAuthResponse(user, accessToken),
      refreshToken,
    };
  }

  // ─── Login ──────────────────────────────────────────────
  async login(
    dto: LoginDto,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    // ✅ PHONE bo'yicha qidirish (login uchun phone ishlatiladi)
    const user = await this.userRepository.findOne({
      where: { fullName: dto.fullName },
      withDeleted: false,
    });

    if (!user) throw new UnauthorizedException('Telefon yoki parol noto\'g\'ri');
    if (!user.isActive) throw new UnauthorizedException('Hisob faol emas');

    const isValidPassword = await bcrypt.compare(dto.password, user.password);
    if (!isValidPassword) throw new UnauthorizedException('Telefon yoki parol noto\'g\'ri');

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    const hashedRefresh = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id, {
      refreshToken: hashedRefresh,
      lastLoginAt: new Date(),
    });

    await this.redisService.set(
      `refresh:${user.id}`,
      'active',
      this.getRefreshTokenExpiresInSeconds(),
    );

    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      entity: AuditEntity.AUTH,
      entityId: user.id,
      metadata: { loginTime: new Date().toISOString() },
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    return {
      ...this.buildAuthResponse(user, accessToken),
      refreshToken,
    };
  }

  // ─── Refresh Token (rotation) ───────────────────────────
  async refreshToken(
    refreshToken: string,
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    let payload: JwtPayload;

    try {
      payload = jwt.verify(refreshToken, REFRESH_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Refresh token yaroqsiz yoki muddati tugagan');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      withDeleted: false,
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi yoki sessiya faol emas');
    }

    const isValidRefresh = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValidRefresh) {
      await this.userRepository.update(user.id, { refreshToken: null });
      await this.redisService.del(`refresh:${user.id}`);
      throw new UnauthorizedException('Refresh token yaroqsiz. Sessiya tugatildi.');
    }

    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    const hashedNewRefresh = await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id, { refreshToken: hashedNewRefresh });

    await this.redisService.set(
      `refresh:${user.id}`,
      'active',
      this.getRefreshTokenExpiresInSeconds(),
    );

    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.TOKEN_REFRESHED,
      entity: AuditEntity.AUTH,
      entityId: user.id,
    });

    return {
      ...this.buildAuthResponse(user, newAccessToken),
      refreshToken: newRefreshToken,
    };
  }

  // ─── Logout ─────────────────────────────────────────────
  async logout(
    user: UserEntity,
    accessToken: string,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const decoded = jwt.decode(accessToken) as { exp?: number } | null;

    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redisService.set(`blacklist:${accessToken}`, '1', ttl);
      }
    }

    await this.userRepository.update(user.id, { refreshToken: null });
    await this.redisService.del(`refresh:${user.id}`);

    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.LOGOUT,
      entity: AuditEntity.AUTH,
      entityId: user.id,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });
  }

  // ─── Change Password ────────────────────────────────────
  async changePassword(user: UserEntity, dto: ChangePasswordDto): Promise<void> {
    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentValid) throw new UnauthorizedException('Joriy parol noto\'g\'ri');

    this.validatePasswordStrength(dto.newPassword);

    const hashedNewPassword = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.userRepository.update(user.id, {
      password: hashedNewPassword,
      refreshToken: null,
    });

    await this.redisService.del(`refresh:${user.id}`);

    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.PASSWORD_CHANGED,
      entity: AuditEntity.AUTH,
      entityId: user.id,
    });
  }

  // ─── Get Profile ────────────────────────────────────────
  async getProfile(
    userId: string,
  ): Promise<Omit<UserEntity, 'password' | 'refreshToken'>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: false,
    });

    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const { password, refreshToken, ...safeUser } = user;
    return safeUser;
  }
}