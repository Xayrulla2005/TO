// TO_BACKEND/src/sale/resipt.service.ts
// Tuzatish: Oldingi qarz hisob-kitobi
// customer.totalDebt — mijozning JORIY umumiy qarzi (CustomerEntity da increment/decrement bilan saqlanadi)
// prevDebt = customer.totalDebt - currentSaleDebt

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { SaleEntity } from '../sale/entities/sale.entity';
import { DebtEntity } from '../debts/entities/debt.entity';

const money = (v: number | string | null | undefined): string => {
  const n = Number(v ?? 0);
  return (
    n.toLocaleString('uz-UZ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + ' $'
  );
};

const toDate = (d?: Date | string | null): string => {
  if (!d) return '-';
  return new Date(d).toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    day:      '2-digit',
    month:    '2-digit',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
  });
};

@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(DebtEntity)
    private readonly debtRepository: Repository<DebtEntity>,
  ) {}

  async generateReceipt(sale: SaleEntity, res: Response): Promise<void> {
    const debtInfo = await this.resolveDebtInfo(sale);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=chek-${sale.saleNumber}.pdf`);

    const doc = new PDFDocument({ margin: 0, size: 'A5', bufferPages: false });
    doc.on('error', (err) => { console.error('PDF xato:', err); if (!res.writableEnded) res.end(); });
    doc.pipe(res);

    try {
      this.build(doc, sale, debtInfo);
      doc.end();
    } catch (err) {
      console.error('PDF build xato:', err);
      if (!res.writableEnded) res.status(500).send('PDF xato');
    }
  }

  // ─── Qarz hisob-kitobi ───────────────────────────────────
  private async resolveDebtInfo(sale: SaleEntity) {
    const customer = (sale as any).customer;

    // Bu savdodagi qarz miqdori
    const debtPayment = (sale.payments ?? []).find(p => p.method === 'DEBT');
    const currentDebt = Math.round(
      Number(
        (sale as any).debtSummary?.currentSaleDebt ??
        debtPayment?.amount ??
        0,
      ) * 100,
    ) / 100;

    // ✅ ASOSIY TUZATISH:
    // customer.totalDebt — CustomerEntity da real vaqtda saqlanadigan JORIY umumiy qarz
    // Bu completeSale() da increment qilingan — eng ishonchli manba
    // prevDebt = totalDebt - currentDebt (bu savdodan oldingi qarz)
    const totalDebt = Math.round(Number(customer?.totalDebt ?? 0) * 100) / 100;
    const prevDebt  = Math.max(0, Math.round((totalDebt - currentDebt) * 100) / 100);

    return {
      currentDebt,
      prevDebt,
      totalDebt,
      hasDebt: totalDebt > 0 || currentDebt > 0,
    };
  }

  // ─── Chek qurish ─────────────────────────────────────────
  private build(
    doc: PDFKit.PDFDocument,
    sale: SaleEntity,
    debt: { currentDebt: number; prevDebt: number; totalDebt: number; hasDebt: boolean },
  ): void {
    const L  = 20;
    const R  = doc.page.width - 20;
    const PW = R - L;
    let y    = 20;

    const customer = (sale as any).customer;
    const seller   = (sale as any).createdBy;
    const payments = sale.payments ?? [];

    const cashAmt = payments.filter(p => p.method === 'CASH').reduce((s, p) => s + Number(p.amount), 0);
    const cardAmt = payments.filter(p => p.method === 'CARD').reduce((s, p) => s + Number(p.amount), 0);
    const debtAmt = payments.filter(p => p.method === 'DEBT').reduce((s, p) => s + Number(p.amount), 0);

    // ── HEADER ───────────────────────────────────────────────
    doc.rect(L, y, PW, 46).fill('#1e293b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16)
       .text('TANIROVKA OPTOM', L, y + 8, { width: PW, align: 'center' });
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
       .text('Savdo cheki', L, y + 30, { width: PW, align: 'center' });
    y += 52;

    // ── CHEK RAQAM + SANA ────────────────────────────────────
    this.line(doc, L, R, y);
    y += 6;
    doc.fillColor('#64748b').font('Helvetica').fontSize(8).text('Chek:', L, y);
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8)
       .text(`#${sale.saleNumber}`, L + 38, y);
    doc.fillColor('#64748b').font('Helvetica').fontSize(8)
       .text(toDate(sale.completedAt || sale.createdAt), L, y, { width: PW, align: 'right' });
    y += 16;

    // ── SOTUVCHI + MIJOZ ─────────────────────────────────────
    this.line(doc, L, R, y);
    y += 6;

    const sellerName = seller?.fullName || seller?.username || '-';
    doc.fillColor('#64748b').font('Helvetica').fontSize(8).text('Sotuvchi:', L, y);
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8)
       .text(sellerName, L + 54, y, { width: PW - 54 });
    y += 14;

    if (customer) {
      doc.fillColor('#64748b').font('Helvetica').fontSize(8).text('Mijoz:', L, y);
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8)
         .text(customer.name, L + 54, y, { width: PW - 140, lineBreak: false });
      if (customer.phone) {
        doc.fillColor('#475569').font('Helvetica').fontSize(8)
           .text(customer.phone, L, y, { width: PW, align: 'right' });
      }
      y += 14;
    }

    // ── MAHSULOTLAR JADVALI ───────────────────────────────────
    y += 4;
    this.line(doc, L, R, y);
    y += 4;

    const col = {
      name:  { x: L,             w: PW * 0.38 },
      unit:  { x: L + PW * 0.38, w: PW * 0.10 },
      qty:   { x: L + PW * 0.48, w: PW * 0.10 },
      price: { x: L + PW * 0.58, w: PW * 0.21 },
      total: { x: L + PW * 0.79, w: PW * 0.21 },
    };

    // Jadval sarlavhasi
    doc.rect(L, y, PW, 18).fill('#334155');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5);
    doc.text('Mahsulot', col.name.x + 4, y + 5);
    doc.text("O'lchov",  col.unit.x,      y + 5, { width: col.unit.w,  align: 'center' });
    doc.text('Miqdor',   col.qty.x,       y + 5, { width: col.qty.w,   align: 'center' });
    doc.text('Narx',     col.price.x,     y + 5, { width: col.price.w, align: 'right'  });
    doc.text('Jami',     col.total.x - 4, y + 5, { width: col.total.w, align: 'right'  });
    y += 18;

    // Mahsulot qatorlari
    sale.items.forEach((item, i) => {
      const base    = Number(item.baseUnitPrice ?? item.customUnitPrice);
      const custom  = Number(item.customUnitPrice);
      const isDisc  = custom < base - 0.01;
      const rowH    = isDisc ? 30 : 24;

      doc.rect(L, y, PW, rowH).fill(i % 2 === 0 ? '#f8fafc' : '#ffffff');

      // Nomi
      doc.fillColor('#1e293b').font('Helvetica').fontSize(8)
         .text(item.productNameSnapshot, col.name.x + 4, y + (isDisc ? 4 : 8),
               { width: col.name.w - 8, lineBreak: false });

      // O'lchov
      doc.fillColor('#64748b').font('Helvetica').fontSize(7.5)
         .text(item.unitSnapshot || 'dona', col.unit.x, y + (isDisc ? 11 : 8),
               { width: col.unit.w, align: 'center', lineBreak: false });

      // Miqdor
      const qtyStr = parseFloat(Number(item.quantity).toFixed(4)).toString();
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8)
         .text(qtyStr, col.qty.x, y + (isDisc ? 11 : 8),
               { width: col.qty.w, align: 'center', lineBreak: false });

      // Narx
      if (isDisc) {
        // Asl narx — kulrang, ustiga chiziq
        doc.fillColor('#94a3b8').font('Helvetica').fontSize(6.5)
           .text(money(base), col.price.x, y + 4,
                 { width: col.price.w, align: 'right', lineBreak: false });
        const lineY = y + 8;
        doc.moveTo(col.price.x + 5, lineY)
           .lineTo(col.price.x + col.price.w - 2, lineY)
           .lineWidth(0.5).strokeColor('#94a3b8').stroke();
        // Chegirma narxi — yashil
        doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(8)
           .text(money(custom), col.price.x, y + 15,
                 { width: col.price.w, align: 'right', lineBreak: false });
        const pct = Math.round((1 - custom / base) * 100);
        doc.fillColor('#16a34a').font('Helvetica').fontSize(6.5)
           .text(`-${pct}%`, col.name.x + 4, y + 17, { lineBreak: false });
      } else {
        doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8)
           .text(money(custom), col.price.x, y + 8,
                 { width: col.price.w, align: 'right', lineBreak: false });
      }

      // Jami
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(9)
         .text(money(item.customTotal), col.total.x - 4, y + (isDisc ? 11 : 8),
               { width: col.total.w, align: 'right', lineBreak: false });

      y += rowH;
      if (y > doc.page.height - 130) { doc.addPage(); y = 20; }
    });

    y += 4;
    this.line(doc, L, R, y, '#cbd5e1');
    y += 6;

    // ── CHEGIRMA ─────────────────────────────────────────────
    const origTotal   = sale.items.reduce((s, i) => s + Number(i.baseTotal ?? i.customTotal), 0);
    const actualTotal = Number(sale.grandTotal);

    if (origTotal > actualTotal + 0.01) {
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
         .text('Asl narx jami:', L, y)
         .text(money(origTotal), L, y, { width: PW, align: 'right' });
      y += 13;
      const discAmt = origTotal - actualTotal;
      const discPct = ((discAmt / origTotal) * 100).toFixed(1);
      doc.fillColor('#16a34a').font('Helvetica').fontSize(8)
         .text(`Chegirma (-${discPct}%):`, L, y)
         .text(`-${money(discAmt)}`, L, y, { width: PW, align: 'right' });
      y += 13;
    }

    // ── JAMI TO'LOV ───────────────────────────────────────────
    doc.rect(L, y, PW, 32).fill('#1e293b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
       .text("UMUMIY TO'LOV:", L + 10, y + 10);
    doc.fillColor('#fbbf24').font('Helvetica-Bold').fontSize(14)
       .text(money(actualTotal), L, y + 8, { width: PW - 10, align: 'right' });
    y += 40;

    // ── TO'LOV TARKIBI ────────────────────────────────────────
    const payRows: { label: string; amount: number; color: string }[] = [];
    if (cashAmt > 0) payRows.push({ label: 'Naqd pul:',     amount: cashAmt, color: '#15803d' });
    if (cardAmt > 0) payRows.push({ label: 'Plastik karta:', amount: cardAmt, color: '#1d4ed8' });
    if (debtAmt > 0) payRows.push({ label: 'Nasiya (qarz):', amount: debtAmt, color: '#dc2626' });

    if (payRows.length > 0) {
      const bH = 14 + payRows.length * 15 + 4;
      doc.rect(L, y, PW, bH).fill('#f1f5f9');
      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8)
         .text("TO'LOV TARKIBI:", L + 6, y + 5);
      y += 17;
      payRows.forEach(row => {
        doc.fillColor('#475569').font('Helvetica').fontSize(8.5).text(row.label, L + 6, y);
        doc.fillColor(row.color).font('Helvetica-Bold').fontSize(8.5)
           .text(money(row.amount), L, y, { width: PW - 6, align: 'right' });
        y += 15;
      });
      y += 4;
    }

    // ── QARZ BLOKI ────────────────────────────────────────────
    if (debt.hasDebt) {
      y += 6;
      // prevDebt > 0 bo'lsa 3 qator, bo'lmasa 2 qator
      const bH = debt.prevDebt > 0 ? 72 : 52;
      doc.rect(L, y, PW, bH).lineWidth(1.5).strokeColor('#dc2626').stroke();
      doc.rect(L, y, PW, 18).fill('#fef2f2');
      doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(9)
         .text("QARZDORLIK MA'LUMOTLARI", L + 6, y + 5);
      y += 21;

      // Bu savdo qarzi
      if (debt.currentDebt > 0) {
        doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
           .text('Bu savdo qarz:', L + 8, y);
        doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(8.5)
           .text(money(debt.currentDebt), L, y, { width: PW - 8, align: 'right' });
        y += 15;
      }

      // Oldingi qarz — bu savdodan OLDINGI qarz
      // totalDebt = customer.totalDebt (CustomerEntity da saqlanadi)
      // prevDebt = totalDebt - currentDebt
      if (debt.prevDebt > 0) {
        doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
           .text('Oldingi qarz:', L + 8, y);
        doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(8.5)
           .text(money(debt.prevDebt), L, y, { width: PW - 8, align: 'right' });
        y += 15;
      }

      this.line(doc, L + 6, R - 6, y, '#fca5a5');
      y += 5;

      // Umumiy qarz = customer.totalDebt (barcha savdolar bo'yicha)
      doc.fillColor('#991b1b').font('Helvetica-Bold').fontSize(10)
         .text('UMUMIY QARZ:', L + 8, y);
      doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(11)
         .text(money(debt.totalDebt), L, y - 1, { width: PW - 8, align: 'right' });
      y += 20;
    }

    // ── FOOTER ────────────────────────────────────────────────
    y += 10;
    this.line(doc, L, R, y);
    y += 8;
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5)
       .text('Xarid uchun rahmat!', L, y, { width: PW, align: 'center' });
    y += 11;
    doc.fillColor('#cbd5e1').fontSize(7)
       .text('Tanirovka Optom', L, y, { width: PW, align: 'center' });
  }

  private line(doc: PDFKit.PDFDocument, x1: number, x2: number, y: number, color = '#e2e8f0') {
    doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.5).strokeColor(color).stroke();
  }
}