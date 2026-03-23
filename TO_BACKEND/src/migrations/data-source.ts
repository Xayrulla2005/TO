// src/data-source.ts
// Migration ishlatish uchun alohida DataSource config
// Bu fayl faqat CLI uchun — app.module.ts ga tegmaydi!

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || process.env.DB_USERNAME,
  password: process.env.DB_PASS || process.env.DB_PASSWORD,
  database: process.env.DB_NAME || process.env.DB_DATABASE,

  // synchronize HECH QACHON true bo'lmasin!
  synchronize: false,

  // Barcha entitylar
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],

  // Migration fayllari
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],

  migrationsTableName: 'typeorm_migrations',
});
