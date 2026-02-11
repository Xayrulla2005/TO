// ============================================================
// src/debts/debts.service.ts - PRODUCTION COMPLETE
// ============================================================
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { DebtEntity, DebtStatus } from "./entities/debt.entity";
import { SaleEntity } from "../sale/entities/sale.entity";
import { DebtQueryDto } from "./dto/debt.query.dto";
import {
  PaginationDto,
  PaginatedResponseDto,
} from "../common/dto/pagination.dto";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import {
  AuditAction,
  AuditEntity as AuditEntityEnum,
} from "../audit-logs/entities/audit-log.entity";
import { SaleQueryDto } from "src/sale/dto/sale.query.dto";
import { MakePaymentDto } from "./dto/make.payment.dto";

@Injectable()
export class DebtsService {
  findById(id: string) {
    throw new Error("Method not implemented.");
  }
  constructor(
    @InjectRepository(DebtEntity)
    private readonly debtRepository: Repository<DebtEntity>,
    @InjectRepository(SaleEntity)
    private readonly saleRepository: Repository<SaleEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: DebtQueryDto) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);

  const qb = this.debtRepository
    .createQueryBuilder("debt")
    .leftJoinAndSelect("debt.sale", "sale")
    .orderBy("debt.createdAt", "DESC");

  if (query.search) {
    qb.andWhere(
      "(debt.debtorName ILIKE :search OR debt.debtorPhone ILIKE :search)",
      { search: `%${query.search}%` },
    );
  }

  if (query.status) {
    qb.andWhere("debt.status = :status", { status: query.status });
  }

  const [debts, total] = await qb
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  const data = debts.map((d) => this.buildDebtResponse(d));

  return PaginatedResponseDto.create(data, total, page, limit);
}


  private buildDebtResponse(d: DebtEntity) {
  return {
    id: d.id,
    debtorName: d.debtorName,
    debtorPhone: d.debtorPhone,
    originalAmount: Number(d.originalAmount),
    remainingAmount: Number(d.remainingAmount),
    status: d.status,
    saleId: d.saleId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

  async findOne(id: string): Promise<DebtEntity> {
    const debt = await this.debtRepository.findOne({
      where: { id },
      relations: ["sale"],
    });

    if (!debt) throw new NotFoundException("Debt not found");
    return debt;
  }

  async makePayment(debtId: string, dto: MakePaymentDto, userId: string): Promise<DebtEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const debt = await queryRunner.manager.findOne(DebtEntity, {
        where: { id: debtId },
        lock: { mode: "pessimistic_write" },
      });

      if (!debt) throw new NotFoundException("Debt not found");

      if (debt.status === DebtStatus.PAID) {
        throw new BadRequestException("Debt is already fully paid");
      }

      if (debt.status === DebtStatus.CANCELLED) {
        throw new BadRequestException("Cannot pay cancelled debt");
      }

      const remaining = Number(debt.remainingAmount);
      const payment = dto.amount;

      if (payment <= 0) {
        throw new BadRequestException("Payment amount must be positive");
      }

      if (payment > remaining) {
        throw new BadRequestException(
          `Payment amount (${payment}) exceeds remaining debt (${remaining})`,
        );
      }

      const beforeSnapshot = {
        remainingAmount: remaining,
        status: debt.status,
      };

      debt.remainingAmount = remaining - payment;

      if (debt.remainingAmount <= 0.01) {
        debt.status = DebtStatus.PAID;
        debt.remainingAmount = 0;
      } else {
        debt.status = DebtStatus.PARTIALLY_PAID;
      }

      if (dto.note) {
        debt.notes = debt.notes ? `${debt.notes}\n${dto.note}` : dto.note;
      }

      await queryRunner.manager.save(debt);

      await queryRunner.commitTransaction();

      await this.auditLogService.log({
        userId,
        action: AuditAction.DEBT_PAYMENT,
        entity: AuditEntityEnum.DEBT,
        entityId: debt.id,
        beforeSnapshot,
        afterSnapshot: {
          remainingAmount: debt.remainingAmount,
          status: debt.status,
          paymentAmount: payment,
        },
        metadata: { debtorName: debt.debtorName },
      });

      return this.findOne(debt.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(debtId: string, userId: string): Promise<DebtEntity> {
    const debt = await this.debtRepository.findOne({ where: { id: debtId } });

    if (!debt) throw new NotFoundException("Debt not found");

    if (debt.status === DebtStatus.PAID) {
      throw new BadRequestException("Cannot cancel paid debt");
    }

    if (debt.status === DebtStatus.CANCELLED) {
      throw new BadRequestException("Debt is already cancelled");
    }

    const beforeStatus = debt.status;
    debt.status = DebtStatus.CANCELLED;
    await this.debtRepository.save(debt);

    await this.auditLogService.log({
      userId,
      action: AuditAction.DEBT_CANCELLED,
      entity: AuditEntityEnum.DEBT,
      entityId: debt.id,
      beforeSnapshot: { status: beforeStatus },
      afterSnapshot: { status: DebtStatus.CANCELLED },
    });

    return this.findOne(debt.id);
  }

  async getDebtSummary(): Promise<{
    totalDebts: number;
    pendingDebts: number;
    partiallyPaidDebts: number;
    paidDebts: number;
    cancelledDebts: number;
    totalRemainingAmount: number;
    totalOriginalAmount: number;
    totalPaidAmount: number;
  }> {
    const summary = await this.debtRepository
      .createQueryBuilder("debt")
      .select("debt.status", "status")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(debt.remaining_amount)", "remainingAmount")
      .addSelect("SUM(debt.original_amount)", "originalAmount")
      .groupBy("debt.status")
      .getRawMany();

    const result = {
      totalDebts: 0,
      pendingDebts: 0,
      partiallyPaidDebts: 0,
      paidDebts: 0,
      cancelledDebts: 0,
      totalRemainingAmount: 0,
      totalOriginalAmount: 0,
      totalPaidAmount: 0,
    };

    for (const row of summary) {
      const count = parseInt(row.count, 10);
      const remaining = parseFloat(row.remainingAmount || 0);
      const original = parseFloat(row.originalAmount || 0);

      result.totalDebts += count;
      result.totalRemainingAmount += remaining;
      result.totalOriginalAmount += original;

      if (row.status === DebtStatus.PENDING) result.pendingDebts = count;
      if (row.status === DebtStatus.PARTIALLY_PAID)
        result.partiallyPaidDebts = count;
      if (row.status === DebtStatus.PAID) result.paidDebts = count;
      if (row.status === DebtStatus.CANCELLED) result.cancelledDebts = count;
    }

    result.totalPaidAmount =
      result.totalOriginalAmount - result.totalRemainingAmount;

    return result;
  }

  
}
