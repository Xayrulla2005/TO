// ============================================================
// src/app.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { typeOrmModuleOptions } from './common/config/typeorm.config';

// Domain Modules
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './user/user.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sale/sale.module';
import { PaymentsModule } from './payments/payments.module'; // Import from service file
import { ReturnsModule } from './return/return.module';
import { InventoryModule } from './inventory/inventory.module'; // re-exported
import { StatisticsModule } from './statistics/statistics.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module'; // re-exported
import { DebtsModule } from './debts/debts.module'; // re-exported
import { ConfigModule } from '@nestjs/config';



@Module({
  imports: [
     ConfigModule.forRoot({
    isGlobal: true,
  }),
    // ─── Database ───────────────────────────────────────
    TypeOrmModule.forRoot(typeOrmModuleOptions),

    // ─── Rate Limiting ──────────────────────────────────
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
      },
    ]),

    // ─── Domain Modules ─────────────────────────────────
    CommonModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    SalesModule,
    PaymentsModule,
    ReturnsModule,
    InventoryModule,
    StatisticsModule,
    AuditLogsModule,
    DebtsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}