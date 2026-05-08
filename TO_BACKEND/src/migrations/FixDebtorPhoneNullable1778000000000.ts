// src/migrations/FixDebtorPhoneNullable1778000000000.ts
// MUAMMO: debtor_phone NOT NULL — nasiya sotuvda xato bermoqda
// YECHIM: debtor_phone ni nullable qilish + customer_id qo'shish

import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDebtorPhoneNullable1778000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {

    // 1. debts.debtor_phone — NOT NULL → nullable
    await queryRunner.query(`
      ALTER TABLE "debts"
      ALTER COLUMN "debtor_phone" DROP NOT NULL;
    `);

    console.log('✅ debts.debtor_phone — nullable qilindi');

    // 2. debts.customer_id — mavjud emasligini tekshirib qo'shamiz
    const debtsTable = await queryRunner.getTable('debts');
    const hasCustomerId = debtsTable?.findColumnByName('customer_id');

    if (!hasCustomerId) {
      await queryRunner.query(`
        ALTER TABLE "debts"
        ADD COLUMN "customer_id" uuid NULL;
      `);
      console.log('✅ debts.customer_id — qo\'shildi');
    } else {
      console.log('ℹ️  debts.customer_id — allaqachon mavjud');
    }

    // 3. debts.debtor_phone uzunligini 20 → 30 ga oshirish (telefon formatlar uchun)
    await queryRunner.query(`
      ALTER TABLE "debts"
      ALTER COLUMN "debtor_phone" TYPE varchar(30);
    `);
    console.log('✅ debts.debtor_phone — length 30 ga oshirildi');

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: debtor_phone ni yana NOT NULL qilamiz
    // Avval NULL qiymatlarni bo'sh string bilan to'ldiramiz
    await queryRunner.query(`
      UPDATE "debts"
      SET "debtor_phone" = ''
      WHERE "debtor_phone" IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "debts"
      ALTER COLUMN "debtor_phone" SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "debts"
      ALTER COLUMN "debtor_phone" TYPE varchar(20);
    `);
  }
}
