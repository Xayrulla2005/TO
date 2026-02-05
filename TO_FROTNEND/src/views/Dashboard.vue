<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold text-gray-900">Boshqaruv paneli</h1>
        <p class="text-sm text-gray-500 mt-1">{{ currentDate }}</p>
      </div>
      <button @click="loadDashboard" :disabled="loading" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        <span v-if="!loading">Yangilash</span>
        <span v-else>Yuklanmoqda...</span>
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      <!-- Today's Sales -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div class="flex items-center justify-between mb-4">
          <div class="p-3 bg-blue-50 rounded-lg">
            <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h3 class="text-sm font-medium text-gray-600">Bugungi savdo</h3>
        <p class="text-2xl font-bold text-gray-900 mt-2">{{ formatMoney(dashboard?.today.totalRevenue) }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ dashboard?.today.totalSales }} ta savdo</p>
      </div>

      <!-- Cash -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div class="flex items-center justify-between mb-4">
          <div class="p-3 bg-green-50 rounded-lg">
            <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
        <h3 class="text-sm font-medium text-gray-600">Naqd</h3>
        <p class="text-2xl font-bold text-gray-900 mt-2">{{ formatMoney(dashboard?.today.cashAmount) }}</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div class="flex items-center justify-between mb-4">
          <div class="p-3 bg-purple-50 rounded-lg">
            <svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
        </div>
        <h3 class="text-sm font-medium text-gray-600">Karta</h3>
        <p class="text-2xl font-bold text-gray-900 mt-2">{{ formatMoney(dashboard?.today.cardAmount) }}</p>
      </div>

      <!-- Debt -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div class="flex items-center justify-between mb-4">
          <div class="p-3 bg-orange-50 rounded-lg">
            <svg class="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
        </div>
        <h3 class="text-sm font-medium text-gray-600">Qarz</h3>
        <p class="text-2xl font-bold text-gray-900 mt-2">{{ formatMoney(dashboard?.today.debtAmount) }}</p>
      </div>
    </div>

    <!-- Two Column Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent Sales -->
      <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="p-6 border-b border-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">So'nggi savdolar</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-100">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Savdo raqami</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summa</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Holat</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vaqt</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="sale in dashboard?.recentSales.slice(0, 5)" :key="sale.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ sale.saleNumber }}</td>
                <td class="px-6 py-4 text-sm text-gray-900">{{ formatMoney(sale.grandTotal) }}</td>
                <td class="px-6 py-4">
                  <span :class="getStatusClass(sale.status)" class="px-2 py-1 text-xs font-medium rounded-full">
                    {{ getStatusText(sale.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">{{ formatDate(sale.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!dashboard?.recentSales.length" class="p-8 text-center text-gray-500">
            Hozircha savdolar yo'q
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="space-y-6">
        <!-- Inventory -->
        <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Ombor</h3>
          <div class="space-y-4">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">Jami mahsulotlar</span>
                <span class="font-semibold text-gray-900">{{ dashboard?.totalProducts }}</span>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">Kam qolgan</span>
                <span class="font-semibold text-orange-600">{{ dashboard?.lowStockProducts }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Debts & Returns -->
        <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Qarzlar va qaytarishlar</h3>
          <div class="space-y-4">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">Kutilayotgan qarzlar</span>
                <span class="font-semibold text-orange-600">{{ dashboard?.pendingDebts }}</span>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">Kutilayotgan qaytarishlar</span>
                <span class="font-semibold text-blue-600">{{ dashboard?.pendingReturns }}</span>
              </div>
            </div>
            <div class="pt-4 border-t border-gray-100">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">Jami qarz summasi</span>
                <span class="font-semibold text-gray-900">{{ formatMoney(dashboard?.totalDebtAmount) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { statisticsService } from '../services/statistics.servic';

const dashboard = ref<any>(null);
const loading = ref(false);

const currentDate = computed(() => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  };
  return now.toLocaleDateString('uz-UZ', options);
});

const loadDashboard = async () => {
  loading.value = true;
  try {
    dashboard.value = await statisticsService.getDashboardStats();
  } catch (error) {
    console.error('Dashboard load error:', error);
  } finally {
    loading.value = false;
  }
};

const formatMoney = (amount: number = 0) => {
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('uz-UZ', { 
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    'DRAFT': 'Qoralama',
    'COMPLETED': 'Yakunlandi',
    'CANCELLED': 'Bekor qilindi',
    'RETURNED': 'Qaytarildi'
  };
  return map[status] || status;
};

const getStatusClass = (status: string) => {
  const map: Record<string, string> = {
    'DRAFT': 'bg-gray-100 text-gray-800',
    'COMPLETED': 'bg-green-100 text-green-800',
    'CANCELLED': 'bg-red-100 text-red-800',
    'RETURNED': 'bg-orange-100 text-orange-800'
  };
  return map[status] || 'bg-gray-100 text-gray-800';
};

onMounted(() => {
  loadDashboard();
});
</script>