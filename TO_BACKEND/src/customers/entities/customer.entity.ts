// path: src/modules/customers/entities/customer.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('customers')
export class CustomerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index() // Ism bo'yicha qidiruvni 10-100 baravar tezlashtiradi
  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Index({ unique: true }) // Phone unique bo'lgani uchun indeks shart
  @Column({ type: 'varchar', length: 20, unique: true })
  phone!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Index() // Ro'yxatni saralash (sorting) tez ishlashi uchun
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

 @Column({ 
  type: 'decimal', 
  precision: 12, 
  scale: 2, 
  default: 0,
  name: 'total_debt', // <--- SHU QATORNI QO'SHING
  transformer: {
    to: (value: number) => value,
    from: (value: string) => parseFloat(value),
  }
})
totalDebt!: number;// Mijozning umumiy qarz miqdori

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

  // Izoh: [x: string]: string | number; qatori olib tashlandi.
  // Buning o'rniga aniq propertylardan foydalanish xotira boshqaruvi uchun xavfsizroq.
