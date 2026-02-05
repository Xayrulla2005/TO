export type StatisticsPeriod = 'today' | 'week' | 'month' | 'year';

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'SALER';
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface CreateCategoryDto {
  name: string;
  parentId?: string | null;
}

export interface UpdateCategoryDto {
  name?: string;
  parentId?: string | null;
}

export interface DashboardSummary {
  totalSales: number;
  totalRevenue: number;
  totalDebts: number;
}

export interface StatisticsResult {
  period: StatisticsPeriod;
  revenue: number;
  salesCount: number;
}

// ============================
// Common / Pagination
// ============================

export type UserRole = 'ADMIN' | 'SALER';



export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ============================
// Auth
// ============================

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

// ============================
// Categories
// ============================

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryDto {
  name: string;
  parentId?: string | null;
}

export interface UpdateCategoryDto {
  name?: string;
  parentId?: string | null;
}

// ============================
// Products
// ============================

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  quantity: number;
  costPrice?: number | null;
  sellPrice?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProductDto {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit?: string | null;
  categoryId?: string | null;
  quantity?: number;
  costPrice?: number | null;
  sellPrice?: number | null;
}

export interface UpdateProductDto {
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  unit?: string | null;
  categoryId?: string | null;
  quantity?: number;
  costPrice?: number | null;
  sellPrice?: number | null;
}

// ============================
// Sales
// ============================

export type SaleStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export type PaymentType = 'CASH' | 'CARD' | 'DEBT';

export interface SaleItem {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  price: number;
  total: number;
}

export interface SalePayment {
  id: string;
  type: PaymentType;
  amount: number;
}

export interface Sale {
  id: string;
  status: SaleStatus;
  totalPrice: number;
  discount?: number | null;
  notes?: string | null;
  items: SaleItem[];
  payments: SalePayment[];
  createdBy?: User;
  createdAt?: string;
}

export interface CreateSaleDto {
  items: Array<{
    productId: string;
    quantity: number;
    price?: number;
  }>;
  totalPrice?: number;
  discount?: number;
  notes?: string | null;
  payments?: Array<{
    type: PaymentType;
    amount: number;
  }>;
}

export interface CompleteSaleDto {
  payments: Array<{
    type: PaymentType;
    amount: number;
  }>;
  totalPrice?: number;
  discount?: number;
  notes?: string | null;
}

// ============================
// Debts
// ============================

export type DebtStatus = 'ACTIVE' | 'PAID' | 'OVERDUE';

export interface Debt {
  id: string;
  saleId: string;
  sale?: Sale;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: DebtStatus;
  dueDate?: string | null;
  createdAt?: string;
}

export interface MakePaymentDto {
  amount: number;
  type?: PaymentType; // agar backendda kerak bo‘lsa
  notes?: string | null;
}

// ============================
// Returns
// ============================

export interface ReturnItem {
  id: string;
  saleItemId: string;
  quantity: number;
  reason?: string | null;
}

export interface Return {
  id: string;
  originalSaleId: string;
  items: ReturnItem[];
  createdAt?: string;
}

export interface CreateReturnDto {
  originalSaleId: string;
  items: Array<{
    saleItemId: string;
    quantity: number;
    reason?: string | null;
  }>;
}

// ============================
// Inventory
// ============================

export type InventoryTransactionType =
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'MANUAL_IN'
  | 'MANUAL_OUT';

export interface InventoryTransaction {
  id: string;
  productId: string;
  type: InventoryTransactionType;
  quantityChange: number;
  reason?: string | null;
  createdAt?: string;
}

export interface AdjustStockDto {
  productId: string;
  quantityChange: number;
  reason?: string | null;
}

// ============================
// Statistics
// ============================

export interface StatisticsResult {
  period: StatisticsPeriod;
  revenue: number;
  salesCount: number;
  debtTotal: number;
  topProducts?: Array<{
    productId: string;
    name: string;
    quantity: number;
  }>;
}

export interface DashboardSummary {
  totalSales: number;
  totalRevenue: number;
  totalDebts: number;
  activeDebts: number;
}
