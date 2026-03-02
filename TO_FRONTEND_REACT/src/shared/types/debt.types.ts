// src/shared/types/debt.types.ts
export type DebtStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface Debt {
  id: string;

  debtorName: string;
  debtorPhone: string;

  originalAmount: number;
  remainingAmount: number;

  status: DebtStatus;

  saleId: string;

  createdAt: string;
  updatedAt: string;
}
