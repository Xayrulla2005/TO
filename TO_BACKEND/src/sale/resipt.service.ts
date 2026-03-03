// ============================================================
// src/receipt/receipt.service.ts
// ============================================================

import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { SaleEntity } from '../sale/entities/sale.entity';

@Injectable()
export class ReceiptService {
  async generateReceipt(sale: SaleEntity, res: Response) {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4', // keyinchalik 80mm qilish mumkin
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=chek-${sale.saleNumber}.pdf`,
    );

    doc.pipe(res);

    // ===== FORMAT HELPERS =====
    const formatMoney = (value: number) =>
      `${Number(value).toLocaleString('uz-UZ')} so'm`;

    const formatDate = (date: Date | string | undefined) => {
      if (!date) return '-';
      return new Date(date).toLocaleString('uz-UZ', {
        timeZone: 'Asia/Tashkent',
        hour12: false,
      });
    };

    const paymentMethodLabel = (method: string) => {
      if (method === 'CASH') return 'Naqd';
      if (method === 'CARD') return 'Karta';
      if (method === 'DEBT') return 'Qarz';
      return method;
    };

    // ===== HEADER =====
    doc
      .fontSize(18)
      .text('SOTUV CHEKI', { align: 'center' })
      .moveDown(1);

    doc
      .fontSize(12)
      .text(`Chek raqami: ${sale.saleNumber}`)
      .text(`Sana: ${formatDate(sale.completedAt || sale.createdAt)}`)
      .text(`Sotuvchi: ${sale.createdBy?.fullName || '-'}`)
      .moveDown();

    doc.text('------------------------------------------');
    doc.moveDown();

    // ===== ITEMS =====
    doc.fontSize(14).text('Mahsulotlar:', { underline: true });
    doc.moveDown(0.5);

    sale.items.forEach((item, index) => {
      doc
        .fontSize(12)
        .text(`${index + 1}. ${item.productNameSnapshot}`)
        .text(`   Soni: ${item.quantity} ta`)
        .text(`   Narxi: ${formatMoney(item.customUnitPrice)}`)
        .text(
          `   Jami: ${formatMoney(
            item.customTotal - item.discountAmount,
          )}`,
        )
        .moveDown(0.5);
    });

    doc.text('------------------------------------------');
    doc.moveDown();

    // ===== TOTALS =====
    doc
      .fontSize(12)
      .text(`Oraliq jami: ${formatMoney(sale.subtotal)}`)
      .text(`Chegirma: ${formatMoney(sale.totalDiscount)}`)
      .moveDown(0.5)
      .fontSize(14)
      .text(`Umumiy summa: ${formatMoney(sale.grandTotal)}`, {
        underline: true,
      });

    doc.moveDown();
    doc.text('------------------------------------------');
    doc.moveDown();

    // ===== PAYMENTS =====
    if (sale.payments?.length) {
      doc.fontSize(13).text('To‘lov turi:', { underline: true });
      doc.moveDown(0.5);

      sale.payments.forEach((p) => {
        doc
          .fontSize(12)
          .text(
            `${paymentMethodLabel(p.method)}: ${formatMoney(p.amount)}`,
          );
      });
    }

    doc.moveDown(2);

    // ===== FOOTER =====
    doc
      .fontSize(12)
      .text('------------------------------------------', {
        align: 'center',
      })
      .text('Xaridingiz uchun rahmat!', { align: 'center' })
      .text('Yana tashrif buyuring!', { align: 'center' });

    doc.end();
  }
}