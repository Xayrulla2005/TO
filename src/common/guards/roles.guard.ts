// ============================================================
// src/common/guards/roles.guard.ts
// ============================================================
import { CanActivate, ExecutionContext, Injectable as Inj2 } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decarators/roles.decarator';
import { UserRole } from '../dto/roles.enum';
import { ForbiddenException } from '@nestjs/common';

@Inj2()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles metadata, allow access (public or already auth-guarded)
    if (!roles || roles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: no user context');
    }

    const hasRole = roles.some((role: UserRole) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${user.role}`,
      );
    }

    return true;
  }
}