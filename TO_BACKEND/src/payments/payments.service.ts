// ============================================================
// src/payments/payments.service.ts
// ============================================================
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { SaleEntity } from '../sale/entities/sale.entity';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/entities/audit-log.entity';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(SaleEntity)
    private readonly saleRepository: Repository<SaleEntity>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findBySale(saleId: string): Promise<PaymentEntity[]> {
    const sale = await this.saleRepository.findOne({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Sale not found');

    return this.paymentRepository.find({
      where: { saleId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<PaymentEntity>> {
    const { page = 1, limit = 50 } = pagination;

    const [payments, total] = await this.paymentRepository.findAndCount({
      relations: ['sale'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.create(payments, total, page, limit);
  }

  async getPaymentSummary(startDate: Date, endDate: Date): Promise<{
    totalCash: number;
    totalCard: number;
    totalDebt: number;
    totalPayments: number;
  }> {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.method', 'method')
      .addSelect('SUM(payment.amount)', 'total')
      .where('payment.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('payment.method')
      .getRawMany();

    const summary = {
      totalCash: 0,
      totalCard: 0,
      totalDebt: 0,
      totalPayments: 0,
    };

    for (const row of result) {
      const amount = parseFloat(row.total);
      if (row.method === 'CASH') summary.totalCash = amount;
      if (row.method === 'CARD') summary.totalCard = amount;
      if (row.method === 'DEBT') summary.totalDebt = amount;
      summary.totalPayments += amount;
    }

    return summary;
  }
}