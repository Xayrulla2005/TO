<template>
  <div class="space-y-6 animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Boshqaruv paneli</h1>
        <p class="text-sm text-gray-500 mt-1">{{ currentDate }}</p>
      </div>
      
      <!-- Period Selector -->
      <div class="flex items-center gap-2 bg-white rounded-xl p-1 shadow-soft">
        <button
          v-for="period in periods"
          :key="period.value"
          @click="selectedPeriod = period.value"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            selectedPeriod === period.value
              ? 'bg-primary-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-50'
          ]"
        >
          {{ period.label }}
        </button>
      </div>
    </div>

    <!-- Main Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Revenue Card -->
      <div class="group bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-strong hover:shadow-xl transition-all duration-300 cursor-pointer">
        <div class="flex items-start justify-between mb-4">
          <div class="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="flex items-center gap-1 text-sm">
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clip-rule="evenodd" />
            </svg>
            <span>+12.5%</span>
          </div>
        </div>
        <h3 class="text-sm font-medium opacity-90">Jami tushum</h3>
        <p class="text-3xl font-bold mt-2">{{ formatMoney(stats?.totalRevenue) }}</p>
        <p class="text-sm opacity-75 mt-1">{{ stats?.totalSales }} ta savdo</p>
      </div>

      <!-- Cash Card -->
      <div class="bg-white rounded-2xl p-6 shadow-soft hover:shadow-medium transition-all duration-300">
        <div class="flex items-start justify-between mb-4">
          <div class="p-3 bg-green-50 rounded-xl">
            <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
        <h3 class="text-sm font-medium text-gray-600">Naqd</h3>
        <p class="text-3xl font-bold text-gray-900 mt-2">{{ formatMoney(stats?.cashAmount) }}</p>
        <div class="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-green-400 to-green-600" :style="{ width: cashPercentage + '%' }"></div>
        </div>
      </div>

      <!-- Card Payments -->
      <div class="bg-white rounded-2xl p-6 shadow-soft hover:shadow-medium transition-all duration-300">
        <div class="flex items-start justify-between mb-4">
          <div class="p-3 bg-purple-50 rounded-xl">
            <svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
        </div>
        <h3 class="text-sm font-medium text-gray-600">Karta</h3>
        <p class="text-3xl font-bold text-gray-900 mt-2">{{ formatMoney(stats?.cardAmount) }}</p>
        <div class="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-purple-400 to-purple-600" :style="{ width: cardPercentage + '%' }"></div>
        </div>
      </div>

      <!-- Profit Card -->
      <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-strong hover:shadow-xl transition-all duration-300">
        <div class="flex items-start justify-between mb-4">
          <div class="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>
        <h3 class="text-sm font-medium opacity-90">Sof foyda</h3>
        <p class="text-3xl font-bold mt-2">{{ formatMoney(stats?.netProfit) }}</p>
        <p class="text-sm opacity-75 mt-1">{{ profitMargin }}% foyda marjasi</p>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Sales Chart -->
      <div class="lg:col-span-2 bg-white rounded-2xl shadow-soft p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Savdo dinamikasi</h2>
            <p class="text-sm text-gray-500">So'nggi 7 kun</p>
          </div>
        </div>
        
        <!-- Simple Bar Chart -->
        <div class="space-y-3">
          <div v-for="(day, index) in chartData" :key="index" class="flex items-center gap-3">
            <span class="text-xs font-medium text-gray-500 w-16">{{ day.label }}</span>
            <div class="flex-1 h-10 bg-gray-50 rounded-lg overflow-hidden relative">
              <div 
                class="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-lg transition-all duration-500 flex items-center justify-end px-3"
                :style="{ width: (day.value / maxChartValue * 100) + '%' }"
              >
                <span v-if="day.value > 0" class="text-xs font-semibold text-white">{{ formatMoney(day.value) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="bg-white rounded-2xl shadow-soft p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Tezkor ko'rsatkichlar</h2>
        <div class="space-y-4">
          <!-- Products -->
          <div class="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-blue-100 rounded-lg">
                <svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p class="text-xs text-gray-600">Mahsulotlar</p>
                <p class="text-lg font-bold text-gray-900">{{ dashboard?.totalProducts }}</p>
              </div>
            </div>
          </div>

          <!-- Low Stock -->
          <div class="flex items-center justify-between p-4 bg-orange-50 rounded-xl">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-orange-100 rounded-lg">
                <svg class="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p class="text-xs text-gray-600">Kam qolgan</p>
                <p class="text-lg font-bold text-gray-900">{{ dashboard?.lowStockProducts }}</p>
              </div>
            </div>
          </div>

          <!-- Debts -->
          <div class="flex items-center justify-between p-4 bg-red-50 rounded-xl">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-red-100 rounded-lg">
                <svg class="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <div>
                <p class="text-xs text-gray-600">Qarzlar</p>
                <p class="text-lg font-bold text-gray-900">{{ dashboard?.pendingDebts }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Sales Table -->
    <div class="bg-white rounded-2xl shadow-soft overflow-hidden">
      <div class="p-6 border-b border-gray-100">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">So'nggi savdolar</h2>
            <p class="text-sm text-gray-500 mt-1">Bugungi savdolar ro'yxati</p>
          </div>
          <router-link to="/sales" class="text-sm font-medium text-primary-600 hover:text-primary-700">
            Barchasini ko'rish →
          </router-link>
        </div>
      </div>
      
      <!-- Desktop Table -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Savdo №</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mijoz</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summa</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">To'lov</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Holat</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vaqt</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="sale in recentSales" :key="sale.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4">
                <span class="text-sm font-mono font-semibold text-gray-900">{{ sale.saleNumber }}</span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ sale.customer || 'Walk-in' }}</td>
              <td class="px-6 py-4 text-sm font-semibold text-gray-900">{{ formatMoney(sale.grandTotal) }}</td>
              <td class="px-6 py-4">
                <span :class="getPaymentBadge(sale.paymentMethod)" class="px-2 py-1 text-xs font-medium rounded-full">
                  {{ sale.paymentMethod }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span :class="getStatusBadge(sale.status)" class="px-2 py-1 text-xs font-medium rounded-full">
                  {{ getStatusText(sale.status) }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">{{ formatTime(sale.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards -->
      <div class="md:hidden divide-y divide-gray-100">
        <div v-for="sale in recentSales" :key="sale.id" class="p-4 hover:bg-gray-50">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-mono font-semibold text-gray-900">{{ sale.saleNumber }}</span>
            <span :class="getStatusBadge(sale.status)" class="px-2 py-1 text-xs font-medium rounded-full">
              {{ getStatusText(sale.status) }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600">{{ formatTime(sale.createdAt) }}</span>
            <span class="font-semibold text-gray-900">{{ formatMoney(sale.grandTotal) }}</span>
          </div>
        </div>
      </div>

      <div v-if="!recentSales.length" class="p-12 text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p class="text-gray-500">Hozircha savdolar yo'q</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { statisticsService } from '../services/statistics.servic';

const selectedPeriod = ref('daily');
const stats = ref<any>(null);
const dashboard = ref<any>(null);
const loading = ref(false);

const periods = [
  { value: 'daily', label: 'Bugun' },
  { value: 'weekly', label: 'Bu hafta' },
  { value: 'monthly', label: 'Bu oy' },
  { value: 'yearly', label: 'Bu yil' }
];

const currentDate = computed(() => {
  return new Date().toLocaleDateString('uz-UZ', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
});

const cashPercentage = computed(() => {
  if (!stats.value?.totalRevenue) return 0;
  return Math.min(100, (stats.value.cashAmount / stats.value.totalRevenue) * 100);
});

const cardPercentage = computed(() => {
  if (!stats.value?.totalRevenue) return 0;
  return Math.min(100, (stats.value.cardAmount / stats.value.totalRevenue) * 100);
});

const profitMargin = computed(() => {
  if (!stats.value?.totalRevenue) return 0;
  return ((stats.value.netProfit / stats.value.totalRevenue) * 100).toFixed(1);
});

const chartData = ref([
  { label: 'Dush', value: 1500000 },
  { label: 'Sesh', value: 2200000 },
  { label: 'Chor', value: 1800000 },
  { label: 'Pay', value: 2800000 },
  { label: 'Juma', value: 3200000 },
  { label: 'Shan', value: 2900000 },
  { label: 'Yak', value: 2600000 },
]);

const maxChartValue = computed(() => Math.max(...chartData.value.map(d => d.value)));

const recentSales = computed(() => dashboard.value?.recentSales || []);

const formatMoney = (amount: number = 0) => {
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
};

const formatTime = (date: string) => {
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

const getStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    'DRAFT': 'bg-gray-100 text-gray-700',
    'COMPLETED': 'bg-green-100 text-green-700',
    'CANCELLED': 'bg-red-100 text-red-700',
    'RETURNED': 'bg-orange-100 text-orange-700'
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

const getPaymentBadge = (method: string) => {
  const map: Record<string, string> = {
    'CASH': 'bg-green-100 text-green-700',
    'CARD': 'bg-blue-100 text-blue-700',
    'DEBT': 'bg-orange-100 text-orange-700'
  };
  return map[method] || 'bg-gray-100 text-gray-700';
};

const loadData = async () => {
  loading.value = true;
  try {
    [stats.value, dashboard.value] = await Promise.all([
      statisticsService.getSalesStats(selectedPeriod.value),
      statisticsService.getDashboardStats()
    ]);
  } catch (error) {
    console.error('Failed to load dashboard:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(loadData);
</script>