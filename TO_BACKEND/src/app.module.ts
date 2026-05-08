import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-yet';

import { typeOrmModuleOptions } from './common/config/typeorm.config';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './user/user.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sale/sale.module';
import { PaymentsModule } from './payments/payments.module';
import { ReturnsModule } from './return/return.module';
import { InventoryModule } from './inventory/inventory.module';
import { StatisticsModule } from './statistics/statistics.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { DebtsModule } from './debts/debts.module';
import { CustomersModule } from './customers/customers.module';

@Module({
  imports: [
    // 1. Environment Variables
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. Redis Cache — Global, lekin interceptor GLOBAL EMAS
    //    Har bir controller o'zi boshqaradi qaysi endpoint keshlanishini
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore.redisStore({
          socket: {
            host: configService.get('REDIS_HOST') || 'localhost',
            port: parseInt(configService.get('REDIS_PORT') || '6379', 10),
          },
          password: configService.get('REDIS_PASSWORD') || undefined,
          ttl: 300_000, // 5 daqiqa (millisecond) — default TTL
        }),
      }),
    }),

    // 3. Database
    TypeOrmModule.forRoot(typeOrmModuleOptions),

    // 4. Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL') || 60_000,
          limit: config.get<number>('THROTTLE_LIMIT') || 120,
        },
      ],
    }),

    // 5. Domain Modules
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
    CustomersModule,
  ],
  providers: [
    // ✅ Faqat Rate Limit Guard — Global
    // ❌ Global CacheInterceptor O'CHIRILDI
    //    (POST/PUT dan keyin eski ma'lumot qaytarishi mumkin edi)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}