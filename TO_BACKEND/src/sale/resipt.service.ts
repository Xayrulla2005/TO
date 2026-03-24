// src/sales/receipt.service.ts — v6
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { SaleEntity } from '../sale/entities/sale.entity';
import { DebtEntity, DebtStatus } from '../debts/entities/debt.entity';

@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(DebtEntity)
    private readonly debtRepository: Repository<DebtEntity>,
  ) {}

  async generateReceipt(sale: SaleEntity, res: Response) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${sale.saleNumber}.pdf`);
    doc.pipe(res);

    const W = doc.page.width;
    const L = 40; const R = W - 40; const PW = R - L;

    const fmt = (v: number | string) =>
      '$' + Number(v).toLocaleString('uz-UZ', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

    const fmtDate = (d?: Date | string) => {
      if (!d) return '-';
      return new Date(d).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const fmtTime = (d?: Date | string) => {
      if (!d) return '';
      return new Date(d).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
    };
    const payLabel = (m: string) =>
      m === 'CASH' ? 'Naqd pul' : m === 'CARD' ? 'Plastik karta' : m === 'DEBT' ? 'Nasiya' : m;

    const hline = (y: number, lw = 0.5, color = '#cccccc') =>
      doc.save().moveTo(L, y).lineTo(R, y).lineWidth(lw).strokeColor(color).stroke().restore();

    const fillRect = (x: number, y: number, w: number, h: number, color: string) =>
      doc.save().rect(x, y, w, h).fillColor(color).fill().restore();

    const cell = (txt: string, x: number, y: number, w: number,
      opts: { align?: 'left' | 'right' | 'center'; bold?: boolean; size?: number; color?: string } = {}) =>
      doc.save().font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 9)
        .fillColor(opts.color || '#1a1a1a')
        .text(txt, x + 4, y + 3, { width: w - 8, align: opts.align || 'left', lineBreak: false }).restore();

    // ── Resolve debt values ────────────────────────────────────────────────────
    // Priority:
    //   1. debtSummary attached by getSaleWithDebtSummary / completeSale (most accurate)
    //   2. Real-time sum from DebtEntity table grouped by customer (always correct)
    //   3. sale.debt.remainingAmount as last resort (no customer linked)

    const debtSummary = (sale as any).debtSummary as {
      previousDebt: number;
      currentSaleDebt: number;
      totalDebtAfter: number;
    } | undefined;

    const customer = (sale as any).customer as { id?: string; name?: string; phone?: string; totalDebt?: number } | null | undefined;
    const debtPayment = (sale.payments ?? []).find(p => p.method === 'DEBT');

    // currentSaleDebt: amount of debt recorded in this specific sale
    const currentSaleDebt: number = debtSummary
      ? parseFloat(Number(debtSummary.currentSaleDebt).toFixed(4))
      : debtPayment
        ? parseFloat(Number(debtPayment.amount).toFixed(4))
        : 0;

    // totalCustomerDebt: real-time sum of all unpaid/partial debts for this customer
    // Always recalculate from DebtEntity — never trust customer.totalDebt cache.
    let totalCustomerDebt = 0;

    if (customer?.id) {
      // Fetch all active debts for this customer directly from the debt table.
      // We join on debtorPhone via the customer record because DebtEntity does
      // not have a direct customerId FK in this schema — it stores debtorPhone.
      // Using phone as the join key mirrors how completeSale links debts to customers.
      const customerPhone = customer.phone;

      if (customerPhone) {
        const activeDebts = await this.debtRepository
          .createQueryBuilder('debt')
          .where('debt.debtorPhone = :phone', { phone: customerPhone })
          .andWhere('debt.status IN (:...statuses)', {
            statuses: [DebtStatus.PENDING, DebtStatus.PARTIALLY_PAID],
          })
          .select(['debt.remainingAmount'])
          .getMany();

        totalCustomerDebt = parseFloat(
          activeDebts
            .reduce((sum, d) => sum + parseFloat(Number(d.remainingAmount).toFixed(4)), 0)
            .toFixed(4),
        );
      }
    } else if (debtSummary) {
      // No customer record but debtSummary was computed by the service layer
      totalCustomerDebt = parseFloat(Number(debtSummary.totalDebtAfter).toFixed(4));
    } else if (debtPayment && sale.debt) {
      // Absolute last resort: use this sale's own debt entity remaining amount
      totalCustomerDebt = parseFloat(Number(sale.debt.remainingAmount || 0).toFixed(4));
    }

    // previousDebt: what the customer owed before THIS sale
    // = totalCustomerDebt minus the debt added by this sale (if still unpaid)
    // If debtSummary is available use it directly (it was captured at completion time).
    const previousDebt: number = debtSummary
      ? parseFloat(Number(debtSummary.previousDebt).toFixed(4))
      : parseFloat(Math.max(0, totalCustomerDebt - currentSaleDebt).toFixed(4));

    const hasAnyDebt = totalCustomerDebt > 0.001;
    const isFullyClean = !hasAnyDebt;

    // ── HEADER ─────────────────────────────────────────────────────────────────
    fillRect(L, 40, PW, 44, '#1e293b');
    doc.save().font('Helvetica-Bold').fontSize(18).fillColor('#ffffff').text('TANIROVKA OPTOM', L, 50, { width: PW, align: 'center' }).restore();
    fillRect(L, 84, PW, 20, '#334155');
    doc.save().font('Helvetica').fontSize(9).fillColor('#94a3b8').text('HISOB-FAKTURA / RECEIPT', L, 89, { width: PW, align: 'center' }).restore();

    let y = 116;

    // ── Sale info ──────────────────────────────────────────────────────────────
    doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text('Chek raqami:', L, y).restore();
    doc.save().font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text(sale.saleNumber, L + 70, y).restore();
    const saleDate = sale.completedAt || sale.createdAt;
    doc.save().font('Helvetica').fontSize(9).fillColor('#64748b').text(`${fmtDate(saleDate)}  ${fmtTime(saleDate)}`, L, y, { width: PW, align: 'right' }).restore();
    y += 16;
    doc.save().font('Helvetica').fontSize(9).fillColor('#64748b').text(`Sotuvchi: `, L, y).restore();
    doc.save().font('Helvetica').fontSize(9).fillColor('#1e293b').text(sale.createdBy?.fullName || '-', L + 50, y).restore();
    y += 20;
    hline(y, 0.5, '#e2e8f0'); y += 8;

    // ── Mijoz ──────────────────────────────────────────────────────────────────
    const customerName = customer?.name || sale.debt?.debtorName;
    const customerPhone = customer?.phone || sale.debt?.debtorPhone;

    if (customerName || customerPhone) {
      const isDebtSale = !!debtPayment;
      const bgColor = isDebtSale ? '#fef3c7' : '#f0f9ff';
      const titleColor = isDebtSale ? '#92400e' : '#075985';
      const textColor = isDebtSale ? '#78350f' : '#0c4a6e';
      fillRect(L, y, PW, 32, bgColor);
      doc.save().font('Helvetica-Bold').fontSize(9).fillColor(titleColor)
        .text(isDebtSale ? "NASIYA OLUVCHI MA'LUMOTLARI" : "MIJOZ MA'LUMOTLARI", L + 8, y + 6).restore();
      if (customerName) doc.save().font('Helvetica').fontSize(9).fillColor(textColor).text(`Mijoz: ${customerName}`, L + 8, y + 19).restore();
      if (customerPhone) doc.save().font('Helvetica').fontSize(9).fillColor(textColor).text(`Tel: ${customerPhone}`, L + 200, y + 19).restore();
      y += 38;
    }

    // ── TABLE ──────────────────────────────────────────────────────────────────
    const hasAnyDiscount = sale.items.some(item =>
      Number(item.baseUnitPrice) > 0 && Number(item.customUnitPrice) < Number(item.baseUnitPrice),
    );
    const col = hasAnyDiscount
      ? { no: { x: L, w: 22 }, name: { x: L + 22, w: 185 }, qty: { x: L + 207, w: 50 }, origPrice: { x: L + 257, w: 70 }, discount: { x: L + 327, w: 55 }, price: { x: L + 382, w: 70 }, total: { x: L + 452, w: 63 } }
      : { no: { x: L, w: 25 }, name: { x: L + 25, w: 225 }, qty: { x: L + 250, w: 65 }, origPrice: { x: L + 315, w: 0 }, discount: { x: L + 315, w: 0 }, price: { x: L + 315, w: 100 }, total: { x: L + 415, w: 100 } };

    doc.save().rect(L, y, PW, 22).fillColor('#1e293b').fill().restore();
    cell('Nr', col.no.x, y, col.no.w, { bold: true, color: '#ffffff', align: 'center' });
    cell('Mahsulot', col.name.x, y, col.name.w, { bold: true, color: '#ffffff' });
    cell('Miqdor', col.qty.x, y, col.qty.w, { bold: true, color: '#ffffff', align: 'center' });
    if (hasAnyDiscount) {
      cell('Asl narx', col.origPrice.x, y, col.origPrice.w, { bold: true, color: '#94a3b8', align: 'right', size: 8 });
      cell('Chegirma', col.discount.x, y, col.discount.w, { bold: true, color: '#fbbf24', align: 'center', size: 8 });
    }
    cell('Narxi', col.price.x, y, col.price.w, { bold: true, color: '#ffffff', align: 'right' });
    cell('Jami', col.total.x, y, col.total.w, { bold: true, color: '#ffffff', align: 'right' });
    y += 22;

    const vlines = hasAnyDiscount
      ? [col.no.x + col.no.w, col.qty.x, col.origPrice.x, col.discount.x, col.price.x, col.total.x]
      : [col.no.x + col.no.w, col.qty.x, col.price.x, col.total.x];

    let originalSubtotal = 0;
    sale.items.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
      const nameLines = Math.ceil(item.productNameSnapshot.length / (hasAnyDiscount ? 22 : 28));
      const rowH = Math.max(20, nameLines * 12 + 8);
      fillRect(L, y, PW, rowH, rowBg);
      const basePrice = Number(item.baseUnitPrice);
      const customPrice = Number(item.customUnitPrice);
      const quantity = parseFloat(item.quantity.toString());
      const itemTotal = Number(item.customTotal) - Number(item.discountAmount);
      originalSubtotal += basePrice * quantity;
      const discPct = basePrice > 0 && customPrice < basePrice
        ? parseFloat(((1 - customPrice / basePrice) * 100).toFixed(1))
        : 0;
      cell(`${idx + 1}`, col.no.x, y, col.no.w, { align: 'center', color: '#64748b', size: 8 });
      doc.save().font('Helvetica').fontSize(9).fillColor('#1e293b').text(item.productNameSnapshot, col.name.x + 4, y + 3, { width: col.name.w - 8, lineBreak: true }).restore();
      cell(String(quantity), col.qty.x, y, col.qty.w, { align: 'center' });
      if (hasAnyDiscount) {
        if (discPct > 0) {
          doc.save().font('Helvetica').fontSize(8).fillColor('#94a3b8').text(fmt(basePrice), col.origPrice.x + 4, y + 3, { width: col.origPrice.w - 8, align: 'right', lineBreak: false }).restore();
          doc.save().moveTo(col.origPrice.x + 4, y + 7).lineTo(col.origPrice.x + col.origPrice.w - 4, y + 7).lineWidth(0.8).strokeColor('#94a3b8').stroke().restore();
          fillRect(col.discount.x + 4, y + 3, col.discount.w - 8, 14, '#fef3c7');
          doc.save().font('Helvetica-Bold').fontSize(8).fillColor('#d97706').text(`-${discPct}%`, col.discount.x + 4, y + 5, { width: col.discount.w - 8, align: 'center', lineBreak: false }).restore();
        } else {
          cell(fmt(basePrice), col.origPrice.x, y, col.origPrice.w, { align: 'right', color: '#94a3b8', size: 8 });
          cell('-', col.discount.x, y, col.discount.w, { align: 'center', color: '#cbd5e1', size: 8 });
        }
      }
      cell(fmt(customPrice), col.price.x, y, col.price.w, { align: 'right', color: discPct > 0 ? '#1d4ed8' : '#1a1a1a', bold: discPct > 0 });
      cell(fmt(itemTotal), col.total.x, y, col.total.w, { align: 'right', bold: true });
      hline(y + rowH, 0.3, '#e2e8f0');
      vlines.forEach(vx => doc.save().moveTo(vx, y).lineTo(vx, y + rowH).lineWidth(0.3).strokeColor('#e2e8f0').stroke().restore());
      y += rowH;
    });

    const tableStartY = y - sale.items.reduce((s, item) =>
      s + Math.max(20, Math.ceil(item.productNameSnapshot.length / (hasAnyDiscount ? 22 : 28)) * 12 + 8), 0) - 22;
    doc.save().rect(L, tableStartY, PW, y - tableStartY).lineWidth(0.8).strokeColor('#1e293b').stroke().restore();
    y += 6;

    // ── Chegirmalar ────────────────────────────────────────────────────────────
    const grandTotal = Number(sale.grandTotal);
    const totalDiscount = Number(sale.totalDiscount);
    const itemPriceDiscount = sale.items.reduce((sum, item) =>
      sum + Math.max(0, (Number(item.baseUnitPrice) - Number(item.customUnitPrice)) * parseFloat(item.quantity.toString())), 0);
    const overallDiscPct = originalSubtotal > 0
      ? parseFloat(((1 - grandTotal / originalSubtotal) * 100).toFixed(2))
      : 0;

    if (itemPriceDiscount > 0) {
      const pct = originalSubtotal > 0 ? parseFloat(((itemPriceDiscount / originalSubtotal) * 100).toFixed(2)) : 0;
      fillRect(L, y, PW, 18, '#eff6ff');
      doc.save().font('Helvetica').fontSize(9).fillColor('#3b82f6').text(`Narx chegirmasi (-${pct}%)`, L + 8, y + 4).restore();
      doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#3b82f6').text(`-${fmt(itemPriceDiscount)}`, L, y + 4, { width: PW - 8, align: 'right' }).restore();
      y += 18;
    }
    if (totalDiscount > 0) {
      const pct = originalSubtotal > 0 ? parseFloat(((totalDiscount / originalSubtotal) * 100).toFixed(2)) : 0;
      fillRect(L, y, PW, 18, '#fef9c3');
      doc.save().font('Helvetica').fontSize(9).fillColor('#ca8a04').text(`Qo'shimcha chegirma (-${pct}%)`, L + 8, y + 4).restore();
      doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#ca8a04').text(`-${fmt(totalDiscount)}`, L, y + 4, { width: PW - 8, align: 'right' }).restore();
      y += 18;
    }
    if (overallDiscPct > 0) {
      fillRect(L, y, PW, 18, '#f0fdf4');
      doc.save().font('Helvetica').fontSize(9).fillColor('#16a34a').text(`Umumiy tejam`, L + 8, y + 4).restore();
      doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#16a34a').text(`-${fmt(originalSubtotal - grandTotal)} (${overallDiscPct}%)`, L, y + 4, { width: PW - 8, align: 'right' }).restore();
      y += 18;
    }
    y += 4;

    // ── Grand Total ────────────────────────────────────────────────────────────
    fillRect(L, y, PW, 28, '#1e293b');
    doc.save().font('Helvetica-Bold').fontSize(12).fillColor('#ffffff').text('JAMI SUMMA:', L + 8, y + 7).restore();
    doc.save().font('Helvetica-Bold').fontSize(14).fillColor('#fbbf24').text(fmt(grandTotal), L, y + 5, { width: PW - 8, align: 'right' }).restore();
    if (overallDiscPct > 0) doc.save().font('Helvetica').fontSize(8).fillColor('#94a3b8').text(`(Asl: ${fmt(originalSubtotal)})`, L + 8, y + 18).restore();
    y += 36;

    // ── TO'LOV MA'LUMOTLARI — faqat CASH va CARD ──────────────────────────────
    const nonDebtPayments = (sale.payments || []).filter(p => p.method !== 'DEBT');
    if (nonDebtPayments.length > 0) {
      y += 6;
      fillRect(L, y, PW, 18, '#f1f5f9');
      doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#475569').text("TO'LOV MA'LUMOTLARI", L + 8, y + 4).restore();
      y += 18;
      nonDebtPayments.forEach(p => {
        fillRect(L, y, PW, 18, '#f0fdf4');
        doc.save().font('Helvetica').fontSize(9).fillColor('#16a34a').text(payLabel(p.method), L + 8, y + 4).restore();
        doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#16a34a').text(fmt(p.amount), L, y + 4, { width: PW - 8, align: 'right' }).restore();
        hline(y + 18, 0.3, '#e2e8f0');
        y += 18;
      });
      doc.save().rect(L, y - nonDebtPayments.length * 18 - 18, PW, 18 + nonDebtPayments.length * 18).lineWidth(0.5).strokeColor('#cbd5e1').stroke().restore();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // QARZDORLIK HOLATI
    // totalCustomerDebt — real-time sum of remainingAmount from DebtEntity table.
    // previousDebt      — total before this sale (totalCustomerDebt - currentSaleDebt).
    // currentSaleDebt   — debt amount added by this sale.
    //
    // Layout:
    //   [header]
    //   Oldingi qarz:       previousDebt     (only if previousDebt > 0)
    //   Bu savdo nasiyasi:  currentSaleDebt  (only if currentSaleDebt > 0)
    //   UMUMIY QOLDIQ:      totalCustomerDebt (always shown)
    // ════════════════════════════════════════════════════════════════════════════
    y += 8;

    const showPreviousDebtRow = previousDebt > 0.001;
    const showThisDebtRow = currentSaleDebt > 0.001;
    const blockStartY = y;

    // Header bar
    fillRect(L, y, PW, 18, hasAnyDebt ? '#1e3a5f' : '#14532d');
    doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text('QARZDORLIK HOLATI', L + 8, y + 4).restore();
    y += 18;

    // Oldingi qarz row
    if (showPreviousDebtRow) {
      fillRect(L, y, PW, 18, '#f8fafc');
      doc.save().font('Helvetica').fontSize(9).fillColor('#64748b').text('Oldingi qarz:', L + 8, y + 4).restore();
      doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text(fmt(previousDebt), L, y + 4, { width: PW - 8, align: 'right' }).restore();
      hline(y + 18, 0.3, '#e2e8f0');
      y += 18;
    }

    // Bu savdo nasiyasi row
    if (showThisDebtRow) {
      fillRect(L, y, PW, 18, '#fef2f2');
      doc.save().font('Helvetica').fontSize(9).fillColor('#dc2626').text('Bu savdo nasiyasi:', L + 8, y + 4).restore();
      doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#dc2626').text(fmt(currentSaleDebt), L, y + 4, { width: PW - 8, align: 'right' }).restore();
      hline(y + 18, 0.3, '#fecaca');
      y += 18;
    }

    // UMUMIY QOLDIQ — main prominent row
    fillRect(L, y, PW, 28, isFullyClean ? '#166534' : '#7f1d1d');
    doc.save().font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text('UMUMIY QOLDIQ:', L + 8, y + 8).restore();
    doc.save().font('Helvetica-Bold').fontSize(14)
      .fillColor(isFullyClean ? '#86efac' : '#fef08a')
      .text(fmt(totalCustomerDebt), L, y + 6, { width: PW - 8, align: 'right' }).restore();
    y += 28;

    // Block border
    const blockHeight = y - blockStartY;
    doc.save().rect(L, blockStartY, PW, blockHeight).lineWidth(0.8).strokeColor(hasAnyDebt ? '#dc2626' : '#16a34a').stroke().restore();

    // ── FOOTER ─────────────────────────────────────────────────────────────────
    y += 20;
    hline(y, 0.5, '#e2e8f0'); y += 10;
    doc.save().font('Helvetica').fontSize(9).fillColor('#94a3b8').text('Xaridingiz uchun tashakkur!', L, y, { width: PW, align: 'center' }).restore();
    y += 13;
    doc.save().font('Helvetica').fontSize(8).fillColor('#cbd5e1').text('Yana tashrif buyuring • tanirovkaoptom.uz', L, y, { width: PW, align: 'center' }).restore();

    doc.end();
  }
}