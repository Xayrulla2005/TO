// ============================================================
// src/types/models.ts - SWAGGER-BASED TYPE DEFINITIONS
// ============================================================

// ─── Common Types ──────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
  timestamp: string;
}

// ─── User & Auth ───────────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  SALER = 'SALER',
}

export interface User {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ─── Category ──────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  parentId: string | null;
  parent?: Category | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  color?: string;
  parentId?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  color?: string;
  parentId?: string;
}

// ─── Product ───────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  categoryId: string | null;
  category?: Category | null;
  purchasePrice: number;
  salePrice: number;
  unit: string;
  stockQuantity: number;
  minStockLimit: number;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateProductDto {
  name: string;
  categoryId?: string;
  purchasePrice: number;
  salePrice: number;
  unit: string;
  stockQuantity?: number;
  minStockLimit?: number;
}

export interface UpdateProductDto {
  name?: string;
  categoryId?: string;
  purchasePrice?: number;
  salePrice?: number;
  unit?: string;
  stockQuantity?: number;
  minStockLimit?: number;
}

// ─── Sale ──────────────────────────────────────────────────

export enum SaleStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  DEBT = 'DEBT',
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  product?: Product;
  productNameSnapshot: string;
  categorySnapshot: string;
  baseUnitPrice: number;
  customUnitPrice: number;
  purchasePriceSnapshot: number;
  quantity: number;
  unitSnapshot: string;
  baseTotal: number;
  customTotal: number;
  discountAmount: number;
}

export interface Payment {
  id: string;
  saleId: string;
  amount: number;
  method: PaymentMethod;
  notes: string | null;
  createdAt: string;
}

export interface Sale {
  id: string;
  saleNumber: string;
  status: SaleStatus;
  subtotal: number;
  totalDiscount: number;
  grandTotal: number;
  grossProfit: number;
  netProfit: number;
  notes: string | null;
  createdById: string;
  createdBy?: User;
  items?: SaleItem[];
  payments?: Payment[];
  debt?: Debt | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface CreateSaleDto {
  items: Array<{
    productId: string;
    quantity: number;
    customUnitPrice?: number;
    discountAmount?: number;
  }>;
  notes?: string;
}

export interface CompleteSaleDto {
  payments: Array<{
    amount: number;
    method: PaymentMethod;
    notes?: string;
  }>;
  debtorName?: string;
  debtorPhone?: string;
  dueDate?: string;
  debtNotes?: string;
}

// ─── Debt ──────────────────────────────────────────────────

export enum DebtStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export interface Debt {
  id: string;
  saleId: string;
  sale?: Sale;
  debtorName: string;
  debtorPhone: string;
  originalAmount: number;
  remainingAmount: number;
  status: DebtStatus;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MakePaymentDto {
  amount: number;
  notes?: string;
}

// ─── Return ────────────────────────────────────────────────

export enum ReturnStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface ReturnItem {
  id: string;
  returnId: string;
  saleItemId: string;
  saleItem?: SaleItem;
  quantity: number;
  refundUnitPrice: number;
  refundTotal: number;
  reason: string | null;
}

export interface Return {
  id: string;
  returnNumber: string;
  originalSaleId: string;
  originalSale?: Sale;
  status: ReturnStatus;
  reason: string;
  refundAmount: number;
  notes: string | null;
  items?: ReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateReturnDto {
  originalSaleId: string;
  items: Array<{
    saleItemId: string;
    quantity: number;
    reason?: string;
  }>;
  reason: string;
  notes?: string;
}

// ─── Inventory ─────────────────────────────────────────────

export enum TransactionType {
  SALE = 'SALE',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  RESTOCK = 'RESTOCK',
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  product?: Product;
  type: TransactionType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceId: string | null;
  referenceType: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AdjustStockDto {
  quantity: number;
  notes?: string;
}

// ─── Statistics ────────────────────────────────────────────

export enum StatisticsPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export interface StatisticsResult {
  period: StatisticsPeriod;
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalQuantitySold: number;
  cashAmount: number;
  cardAmount: number;
  debtAmount: number;
  totalDiscount: number;
  grossProfit: number;
  netProfit: number;
  totalSales: number;
  averageSaleValue: number;
  totalItems: number;
  avgItemsPerSale: number;
}

export interface DashboardSummary {
  today: StatisticsResult;
  thisWeek: StatisticsResult;
  thisMonth: StatisticsResult;
  totalProducts: number;
  totalCategories: number;
  lowStockProducts: number;
  pendingDebts: number;
  pendingReturns: number;
  totalDebtAmount: number;
  recentSales: Array<{
    id: string;
    saleNumber: string;
    status: SaleStatus;
    grandTotal: number;
    createdAt: string;
    createdByUsername: string;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  salesByStatus: Record<string, number>;
}

// ─── Audit Log ─────────────────────────────────────────────

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  RESTORED = 'RESTORED',
  SALE_CREATED = 'SALE_CREATED',
  SALE_COMPLETED = 'SALE_COMPLETED',
  SALE_CANCELLED = 'SALE_CANCELLED',
  RETURN_CREATED = 'RETURN_CREATED',
  RETURN_APPROVED = 'RETURN_APPROVED',
  RETURN_REJECTED = 'RETURN_REJECTED',
  DEBT_PAYMENT = 'DEBT_PAYMENT',
  DEBT_CANCELLED = 'DEBT_CANCELLED',
  INVENTORY_ADJUSTED = 'INVENTORY_ADJUSTED',
  PRICE_OVERRIDE = 'PRICE_OVERRIDE',
  DISCOUNT_APPLIED = 'DISCOUNT_APPLIED',
}

export interface AuditLog {
  id: string;
  userId: string;
  user?: User;
  action: AuditAction;
  entity: string;
  entityId: string;
  beforeSnapshot: Record<string, any> | null;
  afterSnapshot: Record<string, any> | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}