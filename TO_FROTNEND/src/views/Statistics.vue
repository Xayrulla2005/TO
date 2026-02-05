<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Statistika</h1>
      <p class="text-sm text-gray-500 mt-1">Moliyaviy hisobotlar va tahlillar</p>
    </div>

    <!-- Period Selector -->
    <div class="bg-white rounded-lg shadow-sm p-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="period in periods"
          :key="period.value"
          @click="selectedPeriod = period.value"
          :class="selectedPeriod === period.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'"
          class="px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {{ period.label }}
        </button>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h3 class="text-sm font-medium text-gray-600">Jami tushum</h3>
        <p class="text-3xl font-bold text-gray-900 mt-2">{{ formatMoney(stats?.totalRevenue) }}</p>
        <p class="text-sm text-gray-500 mt-1">{{ stats?.totalSales }} ta savdo</p>
      </div>

      <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h3 class="text-sm font-medium text-gray-600">Naqd to'lovlar</h3>
        <p class="text-3xl font-bold text-green-600 mt-2">{{ formatMoney(stats?.cashAmount) }}</p>
      </div>

      <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h3 class="text-sm font-medium text-gray-600">Karta orqali</h3>
        <p class="text-3xl font-bold text-blue-600 mt-2">{{ formatMoney(stats?.cardAmount) }}</p>
      </div>

      <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h3 class="text-sm font-medium text-gray-600">Sof foyda</h3>
        <p class="text-3xl font-bold text-indigo-600 mt-2">{{ formatMoney(stats?.netProfit) }}</p>
      </div>
    </div>

    <!-- Detailed Stats -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Payment Methods -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-100">
        <div class="p-6 border-b">
          <h2 class="text-lg font-semibold">To'lov turlari</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p class="font-medium text-gray-900">Naqd</p>
                <p class="text-sm text-gray-500">Naqd to'lovlar</p>
              </div>
            </div>
            <p class="text-lg font-bold text-gray-900">{{ formatMoney(stats?.cashAmount) }}</p>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <p class="font-medium text-gray-900">Karta</p>
                <p class="text-sm text-gray-500">Plastik karta</p>
              </div>
            </div>
            <p class="text-lg font-bold text-gray-900">{{ formatMoney(stats?.cardAmount) }}</p>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg class="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <div>
                <p class="font-medium text-gray-900">Qarz</p>
                <p class="text-sm text-gray-500">Qarzga sotilgan</p>
              </div>
            </div>
            <p class="text-lg font-bold text-gray-900">{{ formatMoney(stats?.debtAmount) }}</p>
          </div>
        </div>
      </div>

      <!-- Profit -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-100">
        <div class="p-6 border-b">
          <h2 class="text-lg font-semibold">Foyda tahlili</h2>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <div class="flex justify-between text-sm mb-2">
              <span class="text-gray-600">Yalpi foyda</span>
              <span class="font-semibold text-gray-900">{{ formatMoney(stats?.grossProfit) }}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="bg-green-500 h-2 rounded-full" :style="{ width: profitPercentage + '%' }"></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between text-sm mb-2">
              <span class="text-gray-600">Chegirmalar</span>
              <span class="font-semibold text-orange-600">{{ formatMoney(stats?.totalDiscount) }}</span>
            </div>
          </div>

          <div class="pt-4 border-t">
            <div class="flex justify-between">
              <span class="text-gray-900 font-medium">Sof foyda</span>
              <span class="text-xl font-bold text-indigo-600">{{ formatMoney(stats?.netProfit) }}</span>
            </div>
          </div>

          <div class="pt-4 border-t">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">O'rtacha savdo</span>
              <span class="font-semibold text-gray-900">{{ formatMoney(stats?.averageSaleValue) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { statisticsService } from '../services';

const selectedPeriod = ref('daily');
const stats = ref<any>(null);

const periods = [
  { value: 'daily', label: 'Bugun' },
  { value: 'weekly', label: 'Bu hafta' },
  { value: 'monthly', label: 'Bu oy' },
  { value: 'yearly', label: 'Bu yil' }
];

const profitPercentage = computed(() => {
  if (!stats.value?.totalRevenue) return 0;
  return Math.min(100, (stats.value.netProfit / stats.value.totalRevenue) * 100);
});

const formatMoney = (amount: number = 0) => {
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
};

const loadStats = async () => {
  try {
    const result = await statisticsService.getStatistics(selectedPeriod.value);
    stats.value = result;
  } catch (error) {
    console.error('Stats load error:', error);
  }
};

watch(selectedPeriod, loadStats);
onMounted(loadStats);
</script>