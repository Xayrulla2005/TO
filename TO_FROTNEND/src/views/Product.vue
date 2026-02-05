<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Mahsulotlar</h1>

      <button
        @click="loadProducts"
        class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        :disabled="loading"
      >
        {{ loading ? 'Yuklanmoqda...' : 'Yangilash' }}
      </button>
    </div>

    <div v-if="error" class="p-4 bg-red-50 text-red-600 rounded-lg">
      {{ error }}
    </div>

    <div v-if="loading" class="text-gray-500">
      Yuklanmoqda...
    </div>

    <div v-else class="bg-white border rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-600">
          <tr>
            <th class="text-left p-3">Nomi</th>
            <th class="text-left p-3">Kategoriya</th>
            <th class="text-left p-3">Sotuv narxi</th>
            <th class="text-left p-3">Qoldiq</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="p in products"
            :key="p.id"
            class="border-t hover:bg-gray-50"
          >
            <td class="p-3 font-medium text-gray-900">
              {{ p.name }}
            </td>

            <td class="p-3 text-gray-600">
              {{ p.category?.name || '-' }}
            </td>

            <td class="p-3 text-gray-900">
              {{ formatMoney(p.sellPrice) }}
            </td>

            <td class="p-3 text-gray-900">
              {{ p.stock ?? 0 }}
            </td>
          </tr>

          <tr v-if="products.length === 0">
            <td colspan="4" class="p-6 text-center text-gray-500">
              Mahsulotlar topilmadi
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { productsService } from '../services/product.service';

const loading = ref(false);
const error = ref<string | null>(null);
const products = ref<any[]>([]);

function formatMoney(value: any) {
  const n = Number(value || 0);
  return n.toLocaleString('uz-UZ') + " so'm";
}

async function loadProducts() {
  loading.value = true;
  error.value = null;

  try {
    const result = await productsService.list({ page: 1, limit: 50 });
    products.value = result.data || [];
  } catch (e: any) {
    error.value = e?.message || 'Mahsulotlarni yuklashda xatolik';
  } finally {
    loading.value = false;
  }
}

onMounted(loadProducts);
</script>
