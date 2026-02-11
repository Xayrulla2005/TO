// ODDIY VARIANT - faqat sale_number qo'shamiz
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSaleNumber1770623800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Faqat sale_number qo'shamiz, payment method ni o'zgartirmaymiz
    const salesTable = await queryRunner.getTable('sales');
    const saleNumberColumn = salesTable?.findColumnByName('sale_number');
    
    if (!saleNumberColumn) {
      await queryRunner.addColumn(
        'sales',
        new TableColumn({
          name: 'sale_number',
          type: 'varchar',
          length: '30',
          isNullable: true,
        })
      );

      await queryRunner.query(`
        UPDATE sales 
        SET sale_number = CONCAT(
          'SALE-', 
          TO_CHAR(created_at, 'YYYYMMDD'), 
          '-', 
          LPAD(
            (ROW_NUMBER() OVER (PARTITION BY DATE(created_at) ORDER BY created_at))::text, 
            4, 
            '0'
          )
        )
        WHERE sale_number IS NULL;
      `);

      await queryRunner.query(`
        CREATE UNIQUE INDEX UQ_sales_sale_number ON sales(sale_number);
      `);

      await queryRunner.query(`
        ALTER TABLE sales 
        ALTER COLUMN sale_number SET NOT NULL;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS UQ_sales_sale_number;`);
    
    const salesTable = await queryRunner.getTable('sales');
    if (salesTable?.findColumnByName('sale_number')) {
      await queryRunner.dropColumn('sales', 'sale_number');
    }
  }
}