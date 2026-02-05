// ============================================================
// src/common/config/typeorm.config.ts
// ============================================================
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

export const typeOrmOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: String(process.env.DB_PASSWORD),
  database: process.env.DB_DATABASE,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export const typeOrmModuleOptions: TypeOrmModuleOptions = {
  ...typeOrmOptions,
  autoLoadEntities: true,
};

// CLI usage for migrations
export default new DataSource(typeOrmOptions);