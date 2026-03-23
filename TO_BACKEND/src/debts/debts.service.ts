// src/debts/debts.service.ts — PRODUCTION COMPLETE v3
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DebtEntity, DebtStatus } from './entities/debt.entity';
import { DebtPaymentEntity, DebtPaymentMethod } from './entities/debt-payment.entity';
import { SaleEntity } from '../sale/entities/sale.entity';
import { DebtQueryDto } from './dto/debt.query.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  AuditEntity as AuditEntityEnum,
} from '../audit-logs/entities/audit-log.entity';
import { MakePaymentDto } from './dto/make.payment.dto';
import { Response } from 'express';
import PDFDocument from 'pdfkit';

// ── Fix: DebtEntity & { payments: ... } intersection "never" xatosini hal qiladi ──
export interface DebtWithPayments extends Omit<DebtEntity, 'payments'> {
  payments: DebtPaymentEntity[];
}

@Injectable()
export class DebtsService {
  constructor(
    @InjectRepository(DebtEntity)
    private readonly debtRepository: Repository<DebtEntity>,
    @InjectRepository(DebtPaymentEntity)
    private readonly debtPaymentRepository: Repository<DebtPaymentEntity>,
    @InjectRepository(SaleEntity)
    private readonly saleRepository: Repository<SaleEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ── findAll ──────────────────────────────────────────────────
  async findAll(query: DebtQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    const qb = this.debtRepository
      .createQueryBuilder('debt')
      .leftJoinAndSelect('debt.sale', 'sale')
      .orderBy('debt.createdAt', 'DESC');

    if (query.search) {
      qb.andWhere(
        '(debt.debtorName ILIKE :search OR debt.debtorPhone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.status) {
      qb.andWhere('debt.status = :status', { status: query.status });
    }

    const [debts, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return PaginatedResponseDto.create(
      debts.map((d) => this.buildDebtResponse(d)),
      total,
      page,
      limit,
    );
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

  // ── findOne ──────────────────────────────────────────────────
  async findOne(id: string): Promise<DebtEntity> {
    const debt = await this.debtRepository.findOne({
      where: { id },
      relations: ['sale'],
    });
    if (!debt) throw new NotFoundException('Debt not found');
    return debt;
  }

  // ── findOneWithPayments ──────────────────────────────────────
  async findOneWithPayments(id: string): Promise<DebtWithPayments> {
    const debt = await this.debtRepository.findOne({
      where: { id },
      relations: ['sale'],
    });
    if (!debt) throw new NotFoundException('Debt not found');

    const payments = await this.debtPaymentRepository.find({
      where: { debtId: id },
      order: { createdAt: 'DESC' },
    });

    return { ...debt, payments } as DebtWithPayments;
  }

  // ── makePayment ──────────────────────────────────────────────
  async makePayment(
    debtId: string,
    dto: MakePaymentDto,
    userId: string,
  ): Promise<DebtWithPayments> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const debt = await queryRunner.manager.findOne(DebtEntity, {
        where: { id: debtId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!debt) throw new NotFoundException('Debt not found');
      if (debt.status === DebtStatus.PAID)
        throw new BadRequestException("Qarz allaqachon to'liq to'langan");
      if (debt.status === DebtStatus.CANCELLED)
        throw new BadRequestException("Bekor qilingan qarzni to'lab bo'lmaydi");

      const remaining = Number(debt.remainingAmount);
      const payment = Number(dto.amount);

      if (payment <= 0)
        throw new BadRequestException("To'lov summasi musbat bo'lishi kerak");
      if (payment > remaining + 0.01)
        throw new BadRequestException(
          `To'lov summasi (${payment}) qolgan qarzdan (${remaining}) ko'p`,
        );

      const beforeSnapshot = { remainingAmount: remaining, status: debt.status };

      const remainingAfter = Math.max(0, remaining - payment);
      debt.remainingAmount = remainingAfter;
      if (remainingAfter <= 0.01) {
        debt.status = DebtStatus.PAID;
        debt.remainingAmount = 0;
      } else {
        debt.status = DebtStatus.PARTIALLY_PAID;
      }

      const noteText = dto.note || dto.notes;
      if (noteText) {
        debt.notes = debt.notes ? `${debt.notes}\n${noteText}` : noteText;
      }

      const debtPayment = queryRunner.manager.create(DebtPaymentEntity, {
        debtId: debt.id,
        amount: payment,
        paymentMethod: (dto.paymentMethod as unknown as DebtPaymentMethod) ?? DebtPaymentMethod.CASH,
        note: noteText ?? null,
        createdById: userId,
        remainingBefore: remaining,
        remainingAfter: debt.remainingAmount,
      });

      await queryRunner.manager.save(debt);
      await queryRunner.manager.save(debtPayment);
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
        metadata: {
          debtorName: debt.debtorName,
          debtorPhone: debt.debtorPhone,
          paymentAmount: payment,
          paymentMethod: dto.paymentMethod,
          paymentId: debtPayment.id,
        },
      });

      return this.findOneWithPayments(debt.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ── getPayments ──────────────────────────────────────────────
  async getPayments(debtId: string): Promise<DebtPaymentEntity[]> {
    await this.findOne(debtId);
    return this.debtPaymentRepository.find({
      where: { debtId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── cancel ──────────────────────────────────────────────────
  async cancel(debtId: string, userId: string): Promise<DebtEntity> {
    const debt = await this.debtRepository.findOne({ where: { id: debtId } });
    if (!debt) throw new NotFoundException('Debt not found');
    if (debt.status === DebtStatus.PAID)
      throw new BadRequestException("To'langan qarzni bekor qilib bo'lmaydi");
    if (debt.status === DebtStatus.CANCELLED)
      throw new BadRequestException('Qarz allaqachon bekor qilingan');

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

  // ── getDebtSummary ───────────────────────────────────────────
  async getDebtSummary() {
    const summary = await this.debtRepository
      .createQueryBuilder('debt')
      .select('debt.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(debt.remaining_amount)', 'remainingAmount')
      .addSelect('SUM(debt.original_amount)', 'originalAmount')
      .groupBy('debt.status')
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
      if (row.status === DebtStatus.PARTIALLY_PAID) result.partiallyPaidDebts = count;
      if (row.status === DebtStatus.PAID) result.paidDebts = count;
      if (row.status === DebtStatus.CANCELLED) result.cancelledDebts = count;
    }

    result.totalPaidAmount =
      result.totalOriginalAmount - result.totalRemainingAmount;
    return result;
  }

  // ── generateReceipt — Soddalashtirilgan chek ──────────────────
  // totalOriginal, paidAmount, currentRemaining — bulk to'lov uchun
  // frontenddan keladi (umumiy hisob). Agar kelmasa — bitta debt dan hisob
  async generateReceipt(
    debtId: string,
    res: Response,
    amount?: number,
    paymentId?: string,
    totalOriginal?: number,
    paidAmount?: number,
    currentRemaining?: number,
    paymentMethod?: string,
  ): Promise<void> {
    const debt = await this.findOneWithPayments(debtId);

    let targetPayment: DebtPaymentEntity | undefined;
    if (paymentId) {
      targetPayment = debt.payments?.find((p) => p.id === paymentId);
    } else {
      targetPayment = debt.payments?.[0];
    }

    // ── Hisob raqamlari: bulk yoki single ──────────────────
    // Bulk: frontend totalOriginal (=oldingi qoldiq), paidAmount, currentRemaining yuboradi
    // Single: bitta debt dan — targetPayment.remainingBefore ishlatiladi
    const isBulk = totalOriginal !== undefined && paidAmount !== undefined && currentRemaining !== undefined;

    // displayOriginal = to'lovdan OLDINGI qoldiq (mijozga ko'rsatiladigan)
    const displayPaid      = isBulk ? paidAmount!       : (targetPayment ? Number(targetPayment.amount) : (amount ?? 0));
    const displayRemaining = isBulk ? currentRemaining! : Number(debt.remainingAmount);
    const displayOriginal  = isBulk
      ? totalOriginal!   // frontend yuborgan oldingi qoldiq
      : (targetPayment
          ? Number(targetPayment.remainingBefore)   // bitta to'lov: remainingBefore
          : displayRemaining + displayPaid);        // fallback
    const methodRaw   = isBulk ? (paymentMethod ?? 'CASH') : (targetPayment?.paymentMethod ?? 'CASH');
    const methodLabel = methodRaw === 'CASH' ? 'Naqd pul' : 'Plastik karta';
    const isFullyPaid = displayRemaining <= 0.01;

    // ── Receipt size: 80mm thermal-style ──
    const doc = new PDFDocument({ margin: 0, size: [340, 600] });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=qarz-chek-${debtId.slice(0, 8)}.pdf`,
    );
    doc.pipe(res);

    const W = 340;
    const PAD = 20;
    const CW = W - PAD * 2;

    const fmt = (v: number | string) =>
      '$' + Number(v).toLocaleString('uz-UZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const fmtDt = (d?: Date | string) => {
      if (!d) return '-';
      const dt = new Date(d);
      const date = dt.toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' });
      const time = dt.toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
      return `${date}  ${time}`;
    };

    const fillRect = (x: number, y: number, w: number, h: number, color: string) =>
      doc.save().rect(x, y, w, h).fillColor(color).fill().restore();

    const hline = (y: number, color = '#e2e8f0') =>
      doc.save().moveTo(PAD, y).lineTo(W - PAD, y).lineWidth(0.5).strokeColor(color).stroke().restore();

    const row = (label: string, value: string, y: number, opts: {
      labelColor?: string; valueColor?: string; valueBold?: boolean; fontSize?: number; bg?: string;
    } = {}) => {
      const { labelColor = '#64748b', valueColor = '#1e293b', valueBold = false, fontSize = 9, bg } = opts;
      if (bg) fillRect(PAD, y, CW, 20, bg);
      doc.save().font('Helvetica').fontSize(fontSize).fillColor(labelColor).text(label, PAD + 8, y + 5).restore();
      doc.save().font(valueBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(valueColor).text(value, PAD, y + 5, { width: CW - 8, align: 'right' }).restore();
      return y + 20;
    };

    // ── HEADER ──────────────────────────────────────────────
    fillRect(0, 0, W, 52, '#1e3a5f');
    doc.save().font('Helvetica-Bold').fontSize(16).fillColor('#ffffff')
      .text('TANIROVKA OPTOM', 0, 12, { width: W, align: 'center' }).restore();
    doc.save().font('Helvetica').fontSize(8).fillColor('#90cdf4')
      .text("QARZ TO'LOV CHEKI", 0, 34, { width: W, align: 'center' }).restore();

    let y = 60;

    // ── Sana ──────────────────────────────────────────────
    const payDate = targetPayment ? new Date(targetPayment.createdAt) : new Date();
    doc.save().font('Helvetica').fontSize(8).fillColor('#94a3b8')
      .text(fmtDt(payDate), 0, y, { width: W, align: 'center' }).restore();
    y += 18;

    hline(y); y += 10;

    // ── Mijoz ─────────────────────────────────────────────
    fillRect(PAD, y, CW, 36, '#f0f9ff');
    doc.save().font('Helvetica-Bold').fontSize(10).fillColor('#1e3a5f')
      .text(debt.debtorName, PAD + 8, y + 6, { width: CW - 16 }).restore();
    doc.save().font('Helvetica').fontSize(8).fillColor('#475569')
      .text(debt.debtorPhone, PAD + 8, y + 21).restore();
    doc.save().rect(PAD, y, CW, 36).lineWidth(0.5).strokeColor('#bfdbfe').stroke().restore();
    y += 44;

    hline(y); y += 10;

    // ── TO'LANGAN SUMMA — asosiy katta blok ────────────────
    fillRect(PAD, y, CW, 56, '#1e3a5f');
    doc.save().font('Helvetica').fontSize(9).fillColor('#90cdf4')
      .text("TO'LANDI", PAD + 8, y + 8).restore();
    doc.save().font('Helvetica-Bold').fontSize(26).fillColor('#ffffff')
      .text(fmt(displayPaid), PAD, y + 20, { width: CW - 8, align: 'right' }).restore();
    doc.save().font('Helvetica').fontSize(8).fillColor('#64748b')
      .text(methodLabel, PAD + 8, y + 42).restore();
    y += 64;

    hline(y); y += 10;

    // ── 3 qator: Oldingi qoldiq → To'landi → Joriy qoldiq ──
    // 1) To'lovdan oldingi qoldiq
    y = row("Oldingi qoldiq:", fmt(displayOriginal), y, { bg: '#f8fafc', labelColor: '#64748b' });

    // 2) To'landi (yashil)
    y = row("To'landi:", fmt(displayPaid), y, {
      bg: '#f0fdf4', labelColor: '#16a34a', valueColor: '#16a34a', valueBold: true,
    });

    hline(y, '#e2e8f0'); y += 2;

    // 3) Joriy qoldiq — eng muhim qator
    fillRect(PAD, y, CW, 36, isFullyPaid ? '#166534' : '#dc2626');
    doc.save().font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
      .text(isFullyPaid ? "QARZ TO'LANDI!" : 'Joriy qoldiq:', PAD + 8, y + 12).restore();
    doc.save().font('Helvetica-Bold').fontSize(20).fillColor(isFullyPaid ? '#86efac' : '#fef08a')
      .text(isFullyPaid ? '$0' : fmt(displayRemaining), PAD, y + 9, { width: CW - 8, align: 'right' }).restore();
    y += 44;

    // ── FOOTER ────────────────────────────────────────────
    y += 12;
    hline(y); y += 10;
    doc.save().font('Helvetica').fontSize(8).fillColor('#94a3b8')
      .text('Xaridingiz uchun tashakkur!', 0, y, { width: W, align: 'center' }).restore();
    y += 12;
    doc.save().font('Helvetica').fontSize(7).fillColor('#cbd5e1')
      .text('tanirovkaoptom.uz', 0, y, { width: W, align: 'center' }).restore();

    doc.end();
  }
}