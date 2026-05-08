// ─────────────────────────────────────────────────────────────
// EXCEL EXPORT HELPERS — SheetJS (xlsx) bilan
// CustomersPage.tsx da mavjud export funksiyalarini
// SHU FAYLDAN ko'chirib almashtiring
// ─────────────────────────────────────────────────────────────
// npm install xlsx — bir marta o'rnatish kerak

import { format, parseISO } from 'date-fns';
import { formatCurrency } from '../lib/utils';
import { Customer, Sale } from '../../features/customer/api/customers.api';

const fmt = (v: number | string | null | undefined) => `$${formatCurrency(v)}`;

// ─────────────────────────────────────────────────────────────
// 1. BARCHA MIJOZLAR EXCEL
// ─────────────────────────────────────────────────────────────
export async function exportCustomersExcel(customers: Customer[]) {
  const XLSX = await import('xlsx');

  const wsData = [
    // Header
    ['#', 'Ism', 'Telefon', 'Jami qarz ($)', 'Holati', "Ro'yxatga olingan"],
    // Rows
    ...customers.map((c, i) => [
      i + 1,
      c.name,
      c.phone,
      Number(c.totalDebt ?? 0),
      Number(c.totalDebt ?? 0) > 0 ? 'Qarzdor' : "Qarz yo'q",
      format(parseISO(c.createdAt), 'dd.MM.yyyy'),
    ]),
    // Jami
    [
      'JAMI',
      `${customers.length} ta mijoz`,
      '',
      customers.reduce((s, c) => s + Number(c.totalDebt ?? 0), 0),
      `${customers.filter(c => Number(c.totalDebt ?? 0) > 0).length} ta qarzdor`,
      '',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Ustun kengliklari
  ws['!cols'] = [
    { wch: 5  },  // #
    { wch: 32 },  // Ism
    { wch: 18 },  // Telefon
    { wch: 16 },  // Qarz
    { wch: 14 },  // Holat
    { wch: 16 },  // Sana
  ];

  // Sarlavha qatorini qalin qilish
  const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1:F1');
  for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddr]) continue;
    ws[cellAddr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'D6E4F0' } } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mijozlar');
  XLSX.writeFile(wb, `mijozlar_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────
// 2. QARZDORLAR EXCEL
// ─────────────────────────────────────────────────────────────
export async function exportDebtorsExcel(customers: Customer[]) {
  const XLSX = await import('xlsx');

  const debtors = customers
    .filter(c => Number(c.totalDebt ?? 0) > 0)
    .sort((a, b) => Number(b.totalDebt) - Number(a.totalDebt));

  const totalDebt = debtors.reduce((s, c) => s + Number(c.totalDebt), 0);

  const wsData = [
    ['#', 'Ism', 'Telefon', 'Qarz miqdori ($)', 'Holati'],
    ...debtors.map((c, i) => [
      i + 1,
      c.name,
      c.phone,
      Number(c.totalDebt),
      "To'lanmagan",
    ]),
    ['JAMI', `${debtors.length} ta qarzdor`, '', totalDebt, ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 5  },
    { wch: 32 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Qarzdorlar');
  XLSX.writeFile(wb, `qarzdorlar_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────
// 3. BITTA MIJOZ SAVDO TARIXI EXCEL
// ─────────────────────────────────────────────────────────────
export async function exportCustomerSalesExcel(customer: Customer, sales: Sale[]) {
  const XLSX = await import('xlsx');

  // ── Sheet 1: Mijoz ma'lumotlari ──────────────────────────
  const infoData = [
    ['Mijoz:', customer.name],
    ['Telefon:', customer.phone],
    ['Jami qarz:', fmt(customer.totalDebt)],
    ['Eksport sanasi:', format(new Date(), 'dd.MM.yyyy HH:mm')],
    [],
    ['SAVDO TARIXI'],
    [],
    // Savdo header
    [
      'Savdo #', 'Sana', 'Jami ($)', "To'lov turi",
      'Qarz ($)', 'Qarz holati', 'Qaytarishlar',
    ],
    // Savdo rows
    ...sales.map(s => {
      const payMethods = s.payments
        ?.map((p: { method: string; }) =>
          p.method === 'CASH' ? 'Naqd' :
          p.method === 'CARD' ? 'Karta' : 'Nasiya'
        )
        .join(' + ') ?? '—';

      const debtAmount = Number(s.debt?.remainingAmount ?? 0);
      const debtStatus =
        s.debt?.status === 'PAID'           ? "To'liq to'landi"  :
        s.debt?.status === 'PARTIALLY_PAID' ? "Qisman to'landi"  :
        s.debt?.status === 'PENDING'        ? "To'lanmagan"      : '—';

      const returnTotal = s.returns
        ?.filter((r: { status: string; }) => r.status === 'APPROVED')
        .reduce((sum: number, r: { refundAmount: any; }) => sum + Number(r.refundAmount), 0) ?? 0;

      return [
        s.saleNumber,
        format(parseISO(s.completedAt || s.createdAt), 'dd.MM.yyyy HH:mm'),
        Number(s.grandTotal),
        payMethods,
        debtAmount,
        debtStatus,
        returnTotal > 0 ? -returnTotal : 0,
      ];
    }),
    [],
    // Jami qator
    [
      'JAMI',
      `${sales.length} ta savdo`,
      sales.reduce((s, sale) => s + Number(sale.grandTotal), 0),
      '',
      sales.reduce((s, sale) => s + Number(sale.debt?.remainingAmount ?? 0), 0),
      '',
      '',
    ],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(infoData);
  ws1['!cols'] = [
    { wch: 20 },  // Savdo #
    { wch: 18 },  // Sana
    { wch: 14 },  // Jami
    { wch: 20 },  // To'lov turi
    { wch: 14 },  // Qarz
    { wch: 18 },  // Qarz holati
    { wch: 14 },  // Qaytarish
  ];

  // ── Sheet 2: Mahsulotlar ─────────────────────────────────
  const productRows: any[][] = [
    ['Savdo #', 'Mahsulot nomi', 'Miqdor', 'Narx ($)', 'Jami ($)'],
  ];

  for (const sale of sales) {
    for (const item of sale.items) {
      productRows.push([
        sale.saleNumber,
        item.productNameSnapshot,
        item.quantity,
        Number(item.customUnitPrice),
        Number(item.customTotal),
      ]);
    }
  }

  const ws2 = XLSX.utils.aoa_to_sheet(productRows);
  ws2['!cols'] = [
    { wch: 16 },
    { wch: 35 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Savdo tarixi');
  XLSX.utils.book_append_sheet(wb, ws2, 'Mahsulotlar');

  const safeName = customer.name.replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, '_');
  XLSX.writeFile(wb, `mijoz_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────
// 4. BITTA MIJOZ OYLIK STATISTIKA EXCEL
// ─────────────────────────────────────────────────────────────
export async function exportCustomerStatsExcel(
  customer: Customer,
  stats: {
    totalSales: number;
    totalAmount: number;
    totalDebt: number;
    averageOrderValue: number;
    monthlyStats: Record<string, { count: number; amount: number }>;
  },
) {
  const XLSX = await import('xlsx');

  const MONTHS = [
    'Yanvar','Fevral','Mart','Aprel','May','Iyun',
    'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr',
  ];

  // ── Sheet 1: Umumiy ko'rsatkichlar ───────────────────────
  const summaryData = [
    ['Mijoz ma\'lumotlari'],
    [],
    ['Ism:',             customer.name],
    ['Telefon:',         customer.phone],
    ['Jami savdolar:',   stats.totalSales],
    ['Jami summa:',      Number(stats.totalAmount)],
    ['Jami qarz:',       Number(stats.totalDebt)],
    ["O'rtacha buyurtma:", Number(stats.averageOrderValue)],
    ['Eksport sanasi:',  format(new Date(), 'dd.MM.yyyy HH:mm')],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 22 }, { wch: 28 }];

  // ── Sheet 2: Oylik statistika ────────────────────────────
  const monthlyRows: any[][] = [
    ['Oy', 'Savdolar soni', 'Jami summa ($)', "O'rtacha ($)", 'Ulushi (%)'],
  ];

  const entries = Object.entries(stats.monthlyStats)
    .sort((a, b) => b[0].localeCompare(a[0]));

  for (const [key, val] of entries) {
    const [year, month] = key.split('-');
    const label  = `${MONTHS[parseInt(month) - 1]} ${year}`;
    const avg    = val.count > 0 ? val.amount / val.count : 0;
    const share  = stats.totalAmount > 0
      ? Math.round((val.amount / stats.totalAmount) * 100)
      : 0;

    monthlyRows.push([
      label,
      val.count,
      Number(val.amount.toFixed(2)),
      Number(avg.toFixed(2)),
      `${share}%`,
    ]);
  }

  // Jami qator
  monthlyRows.push([
    'JAMI',
    stats.totalSales,
    Number(stats.totalAmount.toFixed(2)),
    Number(stats.averageOrderValue.toFixed(2)),
    '100%',
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet(monthlyRows);
  ws2['!cols'] = [
    { wch: 18 },  // Oy
    { wch: 16 },  // Soni
    { wch: 16 },  // Summa
    { wch: 16 },  // O'rtacha
    { wch: 12 },  // Ulushi
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Umumiy');
  XLSX.utils.book_append_sheet(wb, ws2, 'Oylik');

  const safeName = customer.name.replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, '_');
  XLSX.writeFile(wb, `statistika_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────
// 5. MAHSULOTLAR EXCEL (ProductsPage uchun)
// ─────────────────────────────────────────────────────────────
export async function exportProductsExcel(products: {
  name: string;
  category?: { name: string } | null;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  stockQuantity: number;
  minStockLimit?: number;
}[]) {
  const XLSX = await import('xlsx');

  const UNIT_LABELS: Record<string, string> = {
    piece: 'dona', meter: 'metr', kg: 'kg', litre: 'litr', pack: 'paket',
  };

  const wsData = [
    [
      '#', 'Mahsulot nomi', 'Kategoriya', "O'lchov",
      'Kelish narxi ($)', 'Sotuv narxi ($)',
      'Qoldiq', 'Min chegara', 'Holati', 'Marja (%)',
    ],
    ...products.map((p, i) => {
      const purchasePrice = Number(p.purchasePrice);
      const salePrice     = Number(p.salePrice);
      const margin        = purchasePrice > 0
        ? Math.round(((salePrice - purchasePrice) / purchasePrice) * 100)
        : 0;
      const status =
        p.stockQuantity <= 0                              ? 'Tugagan'   :
        p.stockQuantity <= (p.minStockLimit ?? 5)         ? 'Kam qoldiq' : 'Mavjud';

      return [
        i + 1,
        p.name,
        p.category?.name ?? 'Kategoriyasiz',
        UNIT_LABELS[p.unit] ?? p.unit ?? 'dona',
        purchasePrice,
        salePrice,
        Number(p.stockQuantity),
        Number(p.minStockLimit ?? 0),
        status,
        `${margin}%`,
      ];
    }),
    // Jami
    [
      'JAMI',
      `${products.length} ta mahsulot`,
      '', '', '', '',
      products.reduce((s, p) => s + Number(p.stockQuantity), 0),
      '',
      `${products.filter(p => p.stockQuantity <= 0).length} ta tugagan`,
      '',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 5  },  // #
    { wch: 35 },  // Nomi
    { wch: 18 },  // Kategoriya
    { wch: 10 },  // O'lchov
    { wch: 16 },  // Kelish narxi
    { wch: 16 },  // Sotuv narxi
    { wch: 10 },  // Qoldiq
    { wch: 12 },  // Min
    { wch: 14 },  // Holat
    { wch: 10 },  // Marja
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mahsulotlar');
  XLSX.writeFile(wb, `mahsulotlar_${new Date().toISOString().slice(0, 10)}.xlsx`);
}