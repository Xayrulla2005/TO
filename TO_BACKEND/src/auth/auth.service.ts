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
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      );
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    // Warn but don't block if no special char (optional strength)
    void hasSpecial;
  }

  // ─── Token Generation ───────────────────────────────────
  private generateAccessToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRATION });
  }

  private generateRefreshToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRATION });
  }

  private getAccessTokenExpiresInSeconds(): number {
    const exp = ACCESS_EXPIRATION;
    if (exp.endsWith('m')) return parseInt(exp, 10) * 60;
    if (exp.endsWith('h')) return parseInt(exp, 10) * 3600;
    if (exp.endsWith('s')) return parseInt(exp, 10);
    return 900; // default 15 min
  }

  private getRefreshTokenExpiresInSeconds(): number {
    const exp = REFRESH_EXPIRATION;
    if (exp.endsWith('d')) return parseInt(exp, 10) * 86400;
    if (exp.endsWith('h')) return parseInt(exp, 10) * 3600;
    return 604800; // default 7 days
  }

  // ─── Build Auth Response ────────────────────────────────
  private buildAuthResponse(user: UserEntity, accessToken: string): AuthResponseDto {
    return {
      accessToken,
      expiresIn: this.getAccessTokenExpiresInSeconds(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  // ─── Register ───────────────────────────────────────────
  async register(dto: RegisterDto, requestMeta?: { ipAddress?: string; userAgent?: string }): Promise<AuthResponseDto> {
    this.validatePasswordStrength(dto.password);

    // Check uniqueness
    const existingUsername = await this.userRepository.findOne({
      where: { username: dto.username },
      withDeleted: true,
    });
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const existingEmail = await this.userRepository.findOne({
      where: { email: dto.email },
      withDeleted: true,
    });
    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const refreshToken = this.generateRefreshToken({} as UserEntity); // temp

    const user = await this.userRepository.save(
      this.userRepository.create({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        role: dto.role || UserRole.SALER,
        firstName: dto.firstName || null,
        lastName: dto.lastName || null,
        isActive: true,
        refreshToken: null, // Will be set after creation
        lastLoginAt: new Date(),
      }),
    );

    // Generate proper tokens with the real user ID
    const accessToken = this.generateAccessToken(user);
    const realRefreshToken = this.generateRefreshToken(user);

    // Store hashed refresh token
    const hashedRefresh = await bcrypt.hash(realRefreshToken, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id, { refreshToken: hashedRefresh });

    // Store refresh token TTL in Redis for tracking
    await this.redisService.set(
      `refresh:${user.id}`,
      'active',
      this.getRefreshTokenExpiresInSeconds(),
    );

    // Audit log
    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.CREATED,
      entity: AuditEntity.USER,
      entityId: user.id,
      afterSnapshot: { username: user.username, email: user.email, role: user.role },
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    void refreshToken; // silence unused

    return {
      ...this.buildAuthResponse(user, accessToken),
       refreshToken: realRefreshToken ,
    }
  }

  // ─── Login ──────────────────────────────────────────────
  async login(dto: LoginDto, requestMeta?: { ipAddress?: string; userAgent?: string }): Promise<AuthResponseDto & { refreshToken: string }> {
    const user = await this.userRepository.findOne({
      where: { username: dto.username },
      withDeleted: false,
    });

    if (!user) {
      // Generic message - don't reveal if username exists
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store hashed refresh token in DB
    const hashedRefresh = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id, {
      refreshToken: hashedRefresh,
      lastLoginAt: new Date(),
    });

    // Track refresh token session in Redis
    await this.redisService.set(
      `refresh:${user.id}`,
      'active',
      this.getRefreshTokenExpiresInSeconds(),
    );

    // Audit log
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

  // ─── Refresh Token (with rotation) ──────────────────────
  async refreshToken(refreshToken: string): Promise<AuthResponseDto & { refreshToken: string }> {
    let payload: JwtPayload;

    try {
      payload = jwt.verify(refreshToken, REFRESH_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      withDeleted: false,
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('User not found or no active session');
    }

    // Verify the stored refresh token matches
    const isValidRefresh = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValidRefresh) {
      // Possible token theft - invalidate the session
      await this.userRepository.update(user.id, { refreshToken: null });
      await this.redisService.del(`refresh:${user.id}`);
      throw new UnauthorizedException('Invalid refresh token. Session terminated.');
    }

    // ROTATION: Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    // Update DB with new refresh token
    const hashedNewRefresh = await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id, { refreshToken: hashedNewRefresh });

    // Update Redis TTL
    await this.redisService.set(
      `refresh:${user.id}`,
      'active',
      this.getRefreshTokenExpiresInSeconds(),
    );

    // Audit
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
  async logout(user: UserEntity, accessToken: string, requestMeta?: { ipAddress?: string; userAgent?: string }): Promise<void> {
    // Blacklist the access token
    const decoded = jwt.decode(accessToken) as JwtPayload | null;
    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redisService.set(`blacklist:${accessToken}`, '1', ttl);
      }
    }

    // Clear refresh token from DB
    await this.userRepository.update(user.id, { refreshToken: null });

    // Clear Redis session
    await this.redisService.del(`refresh:${user.id}`);

    // Audit log
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
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    this.validatePasswordStrength(dto.newPassword);

    const hashedNewPassword = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id, {
      password: hashedNewPassword,
      refreshToken: null, // Invalidate all sessions
    });

    // Audit log
    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.PASSWORD_CHANGED,
      entity: AuditEntity.AUTH,
      entityId: user.id,
    });
  }

  // ─── Get Current User Profile ───────────────────────────
  async getProfile(userId: string): Promise<Omit<UserEntity, 'password' | 'refreshToken'>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: false,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return without sensitive fields
   const { password, refreshToken, ...safeUser } = user;

return {
  ...safeUser,
  fullName: user.fullName,
}
}
}