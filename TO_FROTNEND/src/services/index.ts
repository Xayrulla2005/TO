// ============================================================
// src/services/index.ts - TYPED API SERVICES
// ============================================================
import apiClient, { getErrorMessage } from './api';
import type {
  LoginRequest,
  LoginResponse,
  User,
  ChangePasswordRequest,
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
  Product,
  CreateProductDto,
  UpdateProductDto,
  Sale,
  CreateSaleDto,
  CompleteSaleDto,
  Debt,
  MakePaymentDto,
  Return,
  CreateReturnDto,
  InventoryTransaction,
  AdjustStockDto,
  StatisticsResult,
  DashboardSummary,
  StatisticsPeriod,
  PaginationParams,
  PaginatedResponse,
} from '../types/models';

// ─── Auth Service ──────────────────────────────────────────

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post('/auth/login', data);
    return response.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async refreshToken(): Promise<{ accessToken: string }> {
    const response = await apiClient.post('/auth/refresh');
    return response.data.data;
  },

  async getProfile(): Promise<User> {
    const response = await apiClient.get('/auth/profile');
    return response.data.data;
  },

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await apiClient.post('/auth/change-password', data);
  },
};

// ─── Users Service ─────────────────────────────────────────

export const usersService = {
  async list(params: PaginationParams = {}): Promise<PaginatedResponse<User>> {
    const response = await apiClient.get('/users', { params });
    return response.data;
  },

  async getById(id: string): Promise<User> {
    const response = await apiClient.get(`/users/${id}`);
    return response.data.data;
  },

  async create(data: Partial<User> & { password: string }): Promise<User> {
    const response = await apiClient.post('/users', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<User>): Promise<User> {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },

  async restore(id: string): Promise<User> {
    const response = await apiClient.post(`/users/${id}/restore`);
    return response.data.data;
  },
};

// ─── Categories Service ────────────────────────────────────

export const categoriesService = {
  async list(params: PaginationParams = {}): Promise<PaginatedResponse<Category>> {
    const response = await apiClient.get('/categories', { params });
    return response.data;
  },

  async getById(id: string): Promise<Category> {
    const response = await apiClient.get(`/categories/${id}`);
    return response.data.data;
  },

  async create(data: CreateCategoryDto): Promise<Category> {
    const response = await apiClient.post('/categories', data);
    return response.data.data;
  },

  async update(id: string, data: UpdateCategoryDto): Promise<Category> {
    const response = await apiClient.put(`/categories/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/categories/${id}`);
  },

  async restore(id: string): Promise<Category> {
    const response = await apiClient.post(`/categories/${id}/restore`);
    return response.data.data;
  },
};

// ─── Products Service ──────────────────────────────────────

export const productsService = {
  async list(params: PaginationParams = {}): Promise<PaginatedResponse<Product>> {
    const response = await apiClient.get('/products', { params });
    return response.data;
  },

  async getById(id: string): Promise<Product> {
    const response = await apiClient.get(`/products/${id}`);
    return response.data.data;
  },

  async create(data: CreateProductDto | FormData): Promise<Product> {
    const config = data instanceof FormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {};
    const response = await apiClient.post('/products', data, config);
    return response.data.data;
  },

  async update(id: string, data: UpdateProductDto | FormData): Promise<Product> {
    const config = data instanceof FormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {};
    const response = await apiClient.put(`/products/${id}`, data, config);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/products/${id}`);
  },

  async restore(id: string): Promise<Product> {
    const response = await apiClient.post(`/products/${id}/restore`);
    return response.data.data;
  },

  async deleteImage(id: string): Promise<Product> {
    const response = await apiClient.delete(`/products/${id}/image`);
    return response.data.data;
  },

  async getLowStock(threshold?: number): Promise<Product[]> {
    const params = threshold ? { threshold } : {};
    const response = await apiClient.get('/products/low-stock', { params });
    return response.data.data;
  },
};

// ─── Sales Service ─────────────────────────────────────────

export const salesService = {
  async list(params: PaginationParams = {}): Promise<PaginatedResponse<Sale>> {
    const response = await apiClient.get('/sales', { params });
    return response.data;
  },

  async getById(id: string): Promise<Sale> {
    const response = await apiClient.get(`/sales/${id}`);
    return response.data.data;
  },

  async create(data: CreateSaleDto): Promise<Sale> {
    const response = await apiClient.post('/sales', data);
    return response.data.data;
  },

  async updateItems(id: string, items: CreateSaleDto['items']): Promise<Sale> {
    const response = await apiClient.put(`/sales/${id}/items`, { items });
    return response.data.data;
  },

  async complete(id: string, data: CompleteSaleDto): Promise<Sale> {
    const response = await apiClient.post(`/sales/${id}/complete`, data);
    return response.data.data;
  },

  async cancel(id: string, reason: string): Promise<Sale> {
    const response = await apiClient.post(`/sales/${id}/cancel`, { reason });
    return response.data.data;
  },
};

// ─── Debts Service ─────────────────────────────────────────

export const debtsService = {
  async list(params: PaginationParams = {}): Promise<PaginatedResponse<Debt>> {
    const response = await apiClient.get('/debts', { params });
    return response.data;
  },

  async getById(id: string): Promise<Debt> {
    const response = await apiClient.get(`/debts/${id}`);
    return response.data.data;
  },

  async makePayment(id: string, data: MakePaymentDto): Promise<Debt> {
    const response = await apiClient.post(`/debts/${id}/payment`, data);
    return response.data.data;
  },

  async cancel(id: string): Promise<Debt> {
    const response = await apiClient.post(`/debts/${id}/cancel`);
    return response.data.data;
  },

  async getSummary(): Promise<{
    totalDebts: number;
    pendingDebts: number;
    totalRemainingAmount: number;
  }> {
    const response = await apiClient.get('/debts/summary');
    return response.data.data;
  },
};

// ─── Returns Service ───────────────────────────────────────

export const returnsService = {
  async list(params: PaginationParams = {}): Promise<PaginatedResponse<Return>> {
    const response = await apiClient.get('/returns', { params });
    return response.data;
  },

  async getById(id: string): Promise<Return> {
    const response = await apiClient.get(`/returns/${id}`);
    return response.data.data;
  },

  async create(data: CreateReturnDto): Promise<Return> {
    const response = await apiClient.post('/returns', data);
    return response.data.data;
  },

  async approve(id: string): Promise<Return> {
    const response = await apiClient.post(`/returns/${id}/approve`);
    return response.data.data;
  },

  async reject(id: string, notes?: string): Promise<Return> {
    const response = await apiClient.post(`/returns/${id}/reject`, { notes });
    return response.data.data;
  },
};

// ─── Inventory Service ─────────────────────────────────────

export const inventoryService = {
  async getTransactions(params: PaginationParams = {}): Promise<PaginatedResponse<InventoryTransaction>> {
    const response = await apiClient.get('/inventory/transactions', { params });
    return response.data;
  },

  async getProductTransactions(productId: string): Promise<InventoryTransaction[]> {
    const response = await apiClient.get(`/inventory/products/${productId}/transactions`);
    return response.data.data;
  },

  async adjustStock(productId: string, data: AdjustStockDto): Promise<InventoryTransaction> {
    const response = await apiClient.post(`/inventory/products/${productId}/adjust`, data);
    return response.data.data;
  },

  async getLowStockProducts(threshold?: number): Promise<Product[]> {
    const params = threshold ? { threshold } : {};
    const response = await apiClient.get('/inventory/low-stock', { params });
    return response.data.data;
  },

  async getSummary(): Promise<{
    totalProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    totalStockValue: number;
  }> {
    const response = await apiClient.get('/inventory/summary');
    return response.data.data;
  },
};

// ─── Statistics Service ────────────────────────────────────

export const statisticsService = {
  async getDashboard(): Promise<DashboardSummary> {
    const response = await apiClient.get('/statistics/dashboard');
    return response.data.data;
  },

  async getStatistics(
    period: StatisticsPeriod,
    referenceDate?: string,
    customStart?: string,
    customEnd?: string
  ): Promise<StatisticsResult> {
    const params: any = { period };
    if (referenceDate) params.referenceDate = referenceDate;
    if (customStart) params.customStart = customStart;
    if (customEnd) params.customEnd = customEnd;

    const response = await apiClient.get('/statistics', { params });
    return response.data.data;
  },

  async getMonthlyBreakdown(year: number): Promise<StatisticsResult[]> {
    const response = await apiClient.get('/statistics/monthly-breakdown', {
      params: { year }
    });
    return response.data.data;
  },

  async getProductPerformance(
    startDate: string,
    endDate: string,
    limit = 20
  ): Promise<Array<{
    productId: string;
    productName: string;
    categoryName: string;
    totalQuantitySold: number;
    totalRevenue: number;
    totalProfit: number;
    averagePrice: number;
    salesCount: number;
  }>> {
    const response = await apiClient.get('/statistics/product-performance', {
      params: { startDate, endDate, limit }
    });
    return response.data.data;
  },

  async getCategoryPerformance(startDate: string, endDate: string): Promise<Array<{
    categoryId: string;
    categoryName: string;
    totalRevenue: number;
    totalProfit: number;
    productCount: number;
    totalSales: number;
  }>> {
    const response = await apiClient.get('/statistics/category-performance', {
      params: { startDate, endDate }
    });
    return response.data.data;
  },

  async getSalesTrend(days = 30): Promise<Array<{
    date: string;
    sales: number;
    revenue: number;
  }>> {
    const response = await apiClient.get('/statistics/sales-trend', {
      params: { days }
    });
    return response.data.data;
  },
};

// Export all services
export {
  getErrorMessage,
  apiClient,
};