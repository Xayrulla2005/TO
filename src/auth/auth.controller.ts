// ============================================================
// src/auth/auth.controller.ts
// ============================================================
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Request,
  Response,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.auth.dto';
import { RegisterDto } from './dto/register.auth.dto';
import { ChangePasswordDto } from './dto/change.password.dto';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { CurrentUser } from '../common/decarators/current.user.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { UserEntity } from '../user/entities/user.entity';
import { GlobalExceptionFilter } from '../common/filters/http.exception.filter';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

@ApiTags('Auth')
@Controller('api/v1/auth')
@UseFilters(GlobalExceptionFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractToken(req: ExpressRequest): string {
    const auth = req.headers.authorization;
    if (!auth) return '';
    const parts = auth.split(' ');
    return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : '';
  }

  private extractMeta(req: ExpressRequest): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', ''),
      userAgent: req.headers['user-agent'],
    };
  }

  private setCookies(res: ExpressResponse, refreshToken: string, clear = false): void {
    if (clear) {
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth/refresh',
      });
      return;
    }

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  // ─── Register (ADMIN only) ──────────────────────────────
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new user (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  async register(
    @Body() dto: RegisterDto,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<object> {
    const result = await this.authService.register(dto, this.extractMeta(req));
    const { refreshToken, ...response } = result as typeof result & { refreshToken: string };
    this.setCookies(res, refreshToken);
    return response;
  }

  // ─── Login ──────────────────────────────────────────────
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with username and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<object> {
    const result = await this.authService.login(dto, this.extractMeta(req));
    const { refreshToken, ...response } = result;
    this.setCookies(res, refreshToken);
    return response;
  }

  // ─── Refresh Token ──────────────────────────────────────
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<object> {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        status: 401,
        message: 'Refresh token not provided',
        timestamp: new Date().toISOString(),
      });
      return {};
    }

    const result = await this.authService.refreshToken(refreshToken);
    const { refreshToken: newRefreshToken, ...response } = result;
    this.setCookies(res, newRefreshToken);
    return response;
  }

  // ─── Logout ─────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate tokens' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: UserEntity,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<void> {
    const accessToken = this.extractToken(req);
    await this.authService.logout(user, accessToken, this.extractMeta(req));
    this.setCookies(res, '', true); // Clear cookie
  }

  // ─── Change Password ────────────────────────────────────
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @CurrentUser() user: UserEntity,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(user, dto);
    return { message: 'Password changed successfully' };
  }

  // ─── Get Profile ────────────────────────────────────────
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  async getProfile(@CurrentUser() user: UserEntity): Promise<object> {
    return this.authService.getProfile(user.id);
  }
}