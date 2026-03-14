// ============================================================
// src/sale/resipt.service.ts
// ============================================================
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { SaleEntity } from '../sale/entities/sale.entity';

@Injectable()
export class ReceiptService {
  async generateReceipt(sale: SaleEntity, res: Response) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${sale.saleNumber}.pdf`);
    doc.pipe(res);

    const W = doc.page.width;
    const L = 40;
    const R = W - 40;
    const PW = R - L;

    const fmt = (v: number | string) =>
      '$' + Number(v).toLocaleString('uz-UZ', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

    const fmtDate = (d?: Date | string) => {
      if (!d) return '-';
      return new Date(d).toLocaleDateString('uz-UZ', {
        timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric',
      });
    };

    const fmtTime = (d?: Date | string) => {
      if (!d) return '';
      return new Date(d).toLocaleTimeString('uz-UZ', {
        timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit',
      });
    };

    const payLabel = (m: string) =>
      m === 'CASH' ? 'Naqd pul' : m === 'CARD' ? 'Plastik karta' : m === 'DEBT' ? 'Nasiya' : m;

    const hline = (y: number, lw = 0.5, color = '#cccccc') => {
      doc.save().moveTo(L, y).lineTo(R, y).lineWidth(lw).strokeColor(color).stroke().restore();
    };

    const fillRect = (x: number, y: number, w: number, h: number, color: string) => {
      doc.save().rect(x, y, w, h).fillColor(color).fill().restore();
    };

    const cell = (
      txt: string, x: number, y: number, w: number,
      opts: { align?: 'left' | 'right' | 'center'; bold?: boolean; size?: number; color?: string } = {}
    ) => {
      doc.save()
        .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(opts.size || 9)
        .fillColor(opts.color || '#1a1a1a')
        .text(txt, x + 4, y + 3, { width: w - 8, align: opts.align || 'left', lineBreak: false })
        .restore();
    };

    // ── HEADER ──
    fillRect(L, 40, PW, 44, '#1e293b');
    doc.save()
      .font('Helvetica-Bold').fontSize(18).fillColor('#ffffff')
      .text('TANIROVKA OPTOM', L, 50, { width: PW, align: 'center' })
      .restore();

    fillRect(L, 84, PW, 20, '#334155');
    doc.save()
      .font('Helvetica').fontSize(9).fillColor('#94a3b8')
      .text('HISOB-FAKTURA / RECEIPT', L, 89, { width: PW, align: 'center' })
      .restore();

    let y = 116;

    // ── Sale info ──
    doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#64748b')
      .text('Chek raqami:', L, y)
      .restore();
    doc.save().font('Helvetica-Bold').fontSize(10).fillColor('#1e293b')
      .text(sale.saleNumber, L + 70, y)
      .restore();

    const saleDate = sale.completedAt || sale.createdAt;
    doc.save().font('Helvetica').fontSize(9).fillColor('#64748b')
      .text(`${fmtDate(saleDate)}  ${fmtTime(saleDate)}`, L, y, { width: PW, align: 'right' })
      .restore();

    y += 16;
    doc.save().font('Helvetica').fontSize(9).fillColor('#64748b')
      .text(`Sotuvchi: `, L, y)
      .restore();
    doc.save().font('Helvetica').fontSize(9).fillColor('#1e293b')
      .text(sale.createdBy?.fullName || '-', L + 50, y)
      .restore();

    y += 20;
    hline(y, 0.5, '#e2e8f0');
    y += 8;

    // ── Mijoz ma'lumotlari (customer relation yoki debt) ──
    const debtPayment = sale.payments?.find(p => p.method === 'DEBT');
    const customerName = (sale as any).customer?.name || sale.debt?.debtorName;
    const customerPhone = (sale as any).customer?.phone || sale.debt?.debtorPhone;

    if (customerName || customerPhone) {
      const isDebtSale = !!debtPayment;
      const bgColor = isDebtSale ? '#fef3c7' : '#f0f9ff';
      const titleColor = isDebtSale ? '#92400e' : '#075985';
      const textColor = isDebtSale ? '#78350f' : '#0c4a6e';

      fillRect(L, y, PW, isDebtSale ? 52 : 44, bgColor);
      doc.save().font('Helvetica-Bold').fontSize(9).fillColor(titleColor)
        .text(isDebtSale ? "NASIYA OLUVCHI MA'LUMOTLARI" : "MIJOZ MA'LUMOTLARI", L + 8, y + 6)
        .restore();
      if (customerName) {
        doc.save().font('Helvetica').fontSize(9).fillColor(textColor)
          .text(`Mijoz: ${customerName}`, L + 8, y + 19)
          .restore();
      }
      if (customerPhone) {
        doc.save().font('Helvetica').fontSize(9).fillColor(textColor)
          .text(`Tel: ${customerPhone}`, L + 200, y + 19)
          .restore();
      }
      if (isDebtSale && debtPayment) {
        doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#dc2626')
          .text(`Nasiya: ${fmt(debtPayment.amount)}`, L, y + 34, { width: PW - 8, align: 'right' })
          .restore();
        y += 60;
      } else {
        y += 52;
      }
    }

    // ── TABLE ──
    const col = {
      no:    { x: L,           w: 25  },
      name:  { x: L + 25,      w: 225 },
      qty:   { x: L + 250,     w: 65  },
      price: { x: L + 315,     w: 100 },
      total: { x: L + 415,     w: 100 },
    };

    doc.save().rect(L, y, PW, 22).fillColor('#1e293b').fill().restore();

    cell('Nr',            col.no.x,    y, col.no.w,    { bold: true, color: '#ffffff', align: 'center' });
    cell('Mahsulot nomi', col.name.x,  y, col.name.w,  { bold: true, color: '#ffffff' });
    cell('Miqdor',        col.qty.x,   y, col.qty.w,   { bold: true, color: '#ffffff', align: 'center' });
    cell('Narxi',         col.price.x, y, col.price.w, { bold: true, color: '#ffffff', align: 'right' });
    cell('Jami',          col.total.x, y, col.total.w, { bold: true, color: '#ffffff', align: 'right' });

    y += 22;

    const vlines = [col.no.x + col.no.w, col.qty.x, col.price.x, col.total.x];

    sale.items.forEach((item, idx) => {
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? '#f8fafc' : '#ffffff';
      const nameLines = Math.ceil(item.productNameSnapshot.length / 28);
      const rowH = Math.max(20, nameLines * 12 + 8);

      fillRect(L, y, PW, rowH, rowBg);

      const total = Number(item.customTotal) - Number(item.discountAmount);

      cell(`${idx + 1}`, col.no.x, y, col.no.w, { align: 'center', color: '#64748b', size: 8 });
      doc.save()
        .font('Helvetica').fontSize(9).fillColor('#1e293b')
        .text(item.productNameSnapshot, col.name.x + 4, y + 3, { width: col.name.w - 8, lineBreak: true })
        .restore();
      cell(String(parseFloat(item.quantity.toString())), col.qty.x, y, col.qty.w, { align: 'center' });
      cell(fmt(item.customUnitPrice), col.price.x, y, col.price.w, { align: 'right' });
      cell(fmt(total), col.total.x, y, col.total.w, { align: 'right', bold: true });

      hline(y + rowH, 0.3, '#e2e8f0');
      vlines.forEach(vx => {
        doc.save().moveTo(vx, y).lineTo(vx, y + rowH).lineWidth(0.3).strokeColor('#e2e8f0').stroke().restore();
      });

      y += rowH;
    });

    const tableH = 22 + sale.items.reduce((s, item) => {
      const nameLines = Math.ceil(item.productNameSnapshot.length / 28);
      return s + Math.max(20, nameLines * 12 + 8);
    }, 0);
    doc.save().rect(L, y - tableH, PW, tableH).lineWidth(0.8).strokeColor('#1e293b').stroke().restore();

    y += 6;

    if (Number(sale.totalDiscount) > 0) {
      doc.save().font('Helvetica').fontSize(9).fillColor('#64748b')
        .text(`Chegirma: -${fmt(sale.totalDiscount)}`, L, y, { width: PW, align: 'right' })
        .restore();
      y += 16;
    }

    // ── Grand Total ──
    fillRect(L, y, PW, 28, '#1e293b');
    doc.save().font('Helvetica-Bold').fontSize(12).fillColor('#ffffff')
      .text('JAMI SUMMA:', L + 8, y + 7)
      .restore();
    doc.save().font('Helvetica-Bold').fontSize(14).fillColor('#fbbf24')
      .text(fmt(sale.grandTotal), L, y + 5, { width: PW - 8, align: 'right' })
      .restore();
    y += 36;

    // ── PAYMENTS ──
    if (sale.payments?.length) {
      y += 6;
      fillRect(L, y, PW, 18, '#f1f5f9');
      doc.save().font('Helvetica-Bold').fontSize(9).fillColor('#475569')
        .text("TO'LOV MA'LUMOTLARI", L + 8, y + 4)
        .restore();
      y += 18;

      sale.payments.forEach((p) => {
        const isDebt = p.method === 'DEBT';
        fillRect(L, y, PW, 18, isDebt ? '#fef2f2' : '#f0fdf4');
        doc.save()
          .font('Helvetica').fontSize(9)
          .fillColor(isDebt ? '#dc2626' : '#16a34a')
          .text(payLabel(p.method), L + 8, y + 4)
          .restore();
        doc.save()
          .font('Helvetica-Bold').fontSize(9)
          .fillColor(isDebt ? '#dc2626' : '#16a34a')
          .text(fmt(p.amount), L, y + 4, { width: PW - 8, align: 'right' })
          .restore();
        hline(y + 18, 0.3, '#e2e8f0');
        y += 18;
      });

      doc.save().rect(L, y - sale.payments.length * 18 - 18, PW, 18 + sale.payments.length * 18)
        .lineWidth(0.5).strokeColor('#cbd5e1').stroke().restore();
    }

    // ── FOOTER ──
    y += 20;
    hline(y, 0.5, '#e2e8f0');
    y += 10;

    doc.save().font('Helvetica').fontSize(9).fillColor('#94a3b8')
      .text('Xaridingiz uchun tashakkur!', L, y, { width: PW, align: 'center' })
      .restore();
    y += 13;
    doc.save().font('Helvetica').fontSize(8).fillColor('#cbd5e1')
      .text('Yana tashrif buyuring • tanirovkaoptom.uz', L, y, { width: PW, align: 'center' })
      .restore();

    doc.end();
  }
}