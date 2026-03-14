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
import { PaginatedResponseDto } from "../common/dto/pagination.dto";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import {
  AuditAction,
  AuditEntity as AuditEntityEnum,
} from "../audit-logs/entities/audit-log.entity";
import { MakePaymentDto } from "./dto/make.payment.dto";
import { Response } from "express";
import PDFDocument from "pdfkit";

@Injectable()
export class DebtsService {
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

    return PaginatedResponseDto.create(
      debts.map((d) => this.buildDebtResponse(d)),
      total, page, limit,
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
      if (debt.status === DebtStatus.PAID)
        throw new BadRequestException("Debt is already fully paid");
      if (debt.status === DebtStatus.CANCELLED)
        throw new BadRequestException("Cannot pay cancelled debt");

      const remaining = Number(debt.remainingAmount);
      const payment = dto.amount;

      if (payment <= 0)
        throw new BadRequestException("Payment amount must be positive");
      if (payment > remaining)
        throw new BadRequestException(
          `Payment amount (${payment}) exceeds remaining debt (${remaining})`,
        );

      const beforeSnapshot = { remainingAmount: remaining, status: debt.status };

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
        metadata: {
          debtorName: debt.debtorName,
          debtorPhone: debt.debtorPhone,
          paymentAmount: payment,
        },
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
    if (debt.status === DebtStatus.PAID)
      throw new BadRequestException("Cannot cancel paid debt");
    if (debt.status === DebtStatus.CANCELLED)
      throw new BadRequestException("Debt is already cancelled");

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

  async getDebtSummary() {
    const summary = await this.debtRepository
      .createQueryBuilder("debt")
      .select("debt.status", "status")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(debt.remaining_amount)", "remainingAmount")
      .addSelect("SUM(debt.original_amount)", "originalAmount")
      .groupBy("debt.status")
      .getRawMany();

    const result = {
      totalDebts: 0, pendingDebts: 0, partiallyPaidDebts: 0,
      paidDebts: 0, cancelledDebts: 0,
      totalRemainingAmount: 0, totalOriginalAmount: 0, totalPaidAmount: 0,
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

    result.totalPaidAmount = result.totalOriginalAmount - result.totalRemainingAmount;
    return result;
  }

  // ✅ Qarz to'lovi cheki — savdo cheki bilan bir xil dizayn
  async generateReceipt(debtId: string, res: Response, amount?: number): Promise<void> {
    const debt = await this.findOne(debtId);

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=qarz-chek-${debtId.slice(0, 8)}.pdf`,
    );
    doc.pipe(res);

    const W = doc.page.width;
    const L = 40;
    const R = W - 40;
    const PW = R - L;

    const fmt = (v: number | string) =>
      "$" + Number(v).toLocaleString("uz-UZ", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

    const fmtDate = (d?: Date | string) => {
      if (!d) return "-";
      return new Date(d).toLocaleDateString("uz-UZ", {
        timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", year: "numeric",
      });
    };

    const fmtTime = (d?: Date | string) => {
      if (!d) return "";
      return new Date(d).toLocaleTimeString("uz-UZ", {
        timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit",
      });
    };

    const hline = (y: number, lw = 0.5, color = "#cccccc") => {
      doc.save().moveTo(L, y).lineTo(R, y).lineWidth(lw).strokeColor(color).stroke().restore();
    };

    const fillRect = (x: number, y: number, w: number, h: number, color: string) => {
      doc.save().rect(x, y, w, h).fillColor(color).fill().restore();
    };

    const cell = (
      txt: string, x: number, y: number, w: number,
      opts: { align?: "left" | "right" | "center"; bold?: boolean; size?: number; color?: string } = {}
    ) => {
      doc.save()
        .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opts.size || 9)
        .fillColor(opts.color || "#1a1a1a")
        .text(txt, x + 4, y + 3, { width: w - 8, align: opts.align || "left", lineBreak: false })
        .restore();
    };

    // ── HEADER — savdo cheki bilan bir xil ──
    fillRect(L, 40, PW, 44, "#1e293b");
    doc.save()
      .font("Helvetica-Bold").fontSize(18).fillColor("#ffffff")
      .text("TANIROVKA OPTOM", L, 50, { width: PW, align: "center" })
      .restore();

    fillRect(L, 84, PW, 20, "#334155");
    doc.save()
      .font("Helvetica").fontSize(9).fillColor("#94a3b8")
      .text("QARZ TO'LOV CHEKI", L, 89, { width: PW, align: "center" })
      .restore();

    let y = 116;

    // ── Chek raqami + sana ──
    const now = new Date();
    doc.save().font("Helvetica-Bold").fontSize(9).fillColor("#64748b")
      .text("Chek raqami:", L, y)
      .restore();
    doc.save().font("Helvetica-Bold").fontSize(10).fillColor("#1e293b")
      .text(debtId.slice(0, 8).toUpperCase(), L + 70, y)
      .restore();
    doc.save().font("Helvetica").fontSize(9).fillColor("#64748b")
      .text(`${fmtDate(now)}  ${fmtTime(now)}`, L, y, { width: PW, align: "right" })
      .restore();

    y += 20;
    hline(y, 0.5, "#e2e8f0");
    y += 8;

    // ── Mijoz ma'lumotlari — sariq blok (nasiya kabi) ──
    fillRect(L, y, PW, 52, "#fef3c7");
    doc.save().font("Helvetica-Bold").fontSize(9).fillColor("#92400e")
      .text("QARZDOR MA'LUMOTLARI", L + 8, y + 6)
      .restore();
    doc.save().font("Helvetica").fontSize(9).fillColor("#78350f")
      .text(`Mijoz: ${debt.debtorName}`, L + 8, y + 20)
      .restore();
    doc.save().font("Helvetica").fontSize(9).fillColor("#78350f")
      .text(`Tel: ${debt.debtorPhone}`, L + 200, y + 20)
      .restore();
    doc.save().font("Helvetica-Bold").fontSize(9).fillColor("#dc2626")
      .text(
        `Asl savdo: ${debt.sale ? `#${debt.sale.saleNumber}` : "-"}`,
        L + 8, y + 34,
      )
      .restore();
    y += 60;

    // ── Savdo ma'lumotlari (agar mavjud bo'lsa) ──
    if (debt.sale) {
      hline(y, 0.5, "#e2e8f0");
      y += 8;

      fillRect(L, y, PW, 18, "#f1f5f9");
      doc.save().font("Helvetica-Bold").fontSize(9).fillColor("#475569")
        .text("SAVDO MA'LUMOTLARI", L + 8, y + 4)
        .restore();
      y += 18;

      const saleDate = debt.sale.completedAt || debt.sale.createdAt;
      fillRect(L, y, PW, 18, "#f8fafc");
      doc.save().font("Helvetica").fontSize(9).fillColor("#64748b")
        .text(`Savdo raqami: #${debt.sale.saleNumber}`, L + 8, y + 4)
        .restore();
      doc.save().font("Helvetica").fontSize(9).fillColor("#64748b")
        .text(`${fmtDate(saleDate)}  ${fmtTime(saleDate)}`, L, y + 4, { width: PW - 8, align: "right" })
        .restore();
      y += 18;

      fillRect(L, y, PW, 18, "#ffffff");
      doc.save().font("Helvetica").fontSize(9).fillColor("#64748b")
        .text("Savdo summasi:", L + 8, y + 4)
        .restore();
      doc.save().font("Helvetica-Bold").fontSize(9).fillColor("#1e293b")
        .text(fmt(Number(debt.sale.grandTotal)), L, y + 4, { width: PW - 8, align: "right" })
        .restore();
      y += 18;

      doc.save().rect(L, y - 54, PW, 54).lineWidth(0.5).strokeColor("#cbd5e1").stroke().restore();
      y += 6;
    }

    // ── Qarz holati jadvali ──
    const alreadyPaid = Number(debt.originalAmount) - Number(debt.remainingAmount) - (amount ?? 0);

    fillRect(L, y, PW, 18, "#f1f5f9");
    doc.save().font("Helvetica-Bold").fontSize(9).fillColor("#475569")
      .text("QARZ HOLATI", L + 8, y + 4)
      .restore();
    y += 18;

    const rows: { label: string; value: string; bg: string; color: string; bold?: boolean }[] = [
      { label: "Dastlabki qarz:", value: fmt(Number(debt.originalAmount)), bg: "#f8fafc", color: "#1e293b" },
      { label: "Avval to'langan:", value: fmt(Math.max(0, alreadyPaid)), bg: "#ffffff", color: "#16a34a" },
    ];

    if (amount && amount > 0) {
      rows.push({
        label: "Hozir to'landi:",
        value: fmt(amount),
        bg: "#f0fdf4",
        color: "#16a34a",
        bold: true,
      });
    }

    rows.forEach((row) => {
      fillRect(L, y, PW, 20, row.bg);
      doc.save().font(row.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor("#64748b")
        .text(row.label, L + 8, y + 5)
        .restore();
      doc.save().font(row.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(row.color)
        .text(row.value, L, y + 5, { width: PW - 8, align: "right" })
        .restore();
      hline(y + 20, 0.3, "#e2e8f0");
      y += 20;
    });

    doc.save().rect(L, y - rows.length * 20 - 18, PW, 18 + rows.length * 20)
      .lineWidth(0.5).strokeColor("#cbd5e1").stroke().restore();

    y += 6;

    // ── Qolgan qarz — grand total kabi ──
    const statusMap: Record<string, string> = {
      PENDING: "To'lanmagan",
      PARTIALLY_PAID: "Qisman to'langan",
      PAID: "To'liq to'langan",
      CANCELLED: "Bekor qilingan",
    };

    const isPaid = debt.status === DebtStatus.PAID;
    fillRect(L, y, PW, 28, isPaid ? "#166534" : "#1e293b");
    doc.save().font("Helvetica-Bold").fontSize(12).fillColor("#ffffff")
      .text(isPaid ? "QARZ TO'LANDI!" : "QOLGAN QARZ:", L + 8, y + 7)
      .restore();
    doc.save().font("Helvetica-Bold").fontSize(14).fillColor(isPaid ? "#86efac" : "#fbbf24")
      .text(
        isPaid ? statusMap[debt.status] : fmt(Number(debt.remainingAmount)),
        L, y + 5, { width: PW - 8, align: "right" }
      )
      .restore();
    y += 36;

    // ── FOOTER ──
    y += 10;
    hline(y, 0.5, "#e2e8f0");
    y += 10;

    doc.save().font("Helvetica").fontSize(9).fillColor("#94a3b8")
      .text("Xaridingiz uchun tashakkur!", L, y, { width: PW, align: "center" })
      .restore();
    y += 13;
    doc.save().font("Helvetica").fontSize(8).fillColor("#cbd5e1")
      .text("Yana tashrif buyuring • tanirovkaoptom.uz", L, y, { width: PW, align: "center" })
      .restore();

    doc.end();
  }
}