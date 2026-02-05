<template>
  <div class="max-w-7xl mx-auto space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Yangi savdo</h1>
      <button @click="clearCart" v-if="cart.length" class="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50">
        Tozalash
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Products (Left) -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Search -->
        <div class="bg-white rounded-lg shadow-sm p-4">
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            placeholder="Mahsulot qidirish..."
            class="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            @input="handleSearch"
          />
        </div>

        <!-- Products Grid -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <button
            v-for="product in filteredProducts"
            :key="product.id"
            @click="addToCart(product)"
            class="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow text-left border border-gray-100"
            :class="{ 'opacity-50': product.stockQuantity === 0 }"
            :disabled="product.stockQuantity === 0"
          >
            <div class="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
              <img v-if="product.imageUrl" :src="product.imageUrl" class="w-full h-full object-cover" />
              <svg v-else class="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 class="font-semibold text-sm text-gray-900 mb-1 truncate">{{ product.name }}</h3>
            <p class="text-lg font-bold text-indigo-600">{{ formatMoney(product.salePrice) }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ product.stockQuantity }} {{ product.unit }}</p>
          </button>
        </div>
      </div>

      <!-- Cart (Right) - Sticky on mobile -->
      <div class="lg:col-span-1">
        <div class="bg-white rounded-lg shadow-lg sticky top-4">
          <div class="p-4 border-b bg-gray-50">
            <h2 class="text-lg font-semibold">Savat</h2>
            <p class="text-sm text-gray-500">{{ cart.length }} ta mahsulot</p>
          </div>

          <!-- Cart Items -->
          <div class="max-h-96 overflow-y-auto p-4 space-y-3">
            <div v-for="(item, index) in cart" :key="index" class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-sm truncate">{{ item.product.name }}</h3>
                <p class="text-xs text-gray-500">{{ formatMoney(item.price) }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <button @click="updateQuantity(index, -1)" class="w-8 h-8 bg-white rounded-lg border flex items-center justify-center">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                    </svg>
                  </button>
                  <input
                    v-model.number="item.quantity"
                    type="number"
                    min="1"
                    class="w-16 px-2 py-1 text-center border rounded-lg"
                  />
                  <button @click="updateQuantity(index, 1)" class="w-8 h-8 bg-white rounded-lg border flex items-center justify-center">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="text-right">
                <p class="font-bold text-gray-900">{{ formatMoney(item.price * item.quantity) }}</p>
                <button @click="removeFromCart(index)" class="text-red-600 text-xs mt-1">O'chirish</button>
              </div>
            </div>
            <div v-if="!cart.length" class="text-center text-gray-500 py-8">
              Savat bo'sh
            </div>
          </div>

          <!-- Totals -->
          <div class="p-4 border-t space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Jami:</span>
              <span class="font-semibold">{{ formatMoney(subtotal) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Chegirma:</span>
              <input
                v-model.number="discount"
                type="number"
                min="0"
                :max="subtotal"
                class="w-32 px-2 py-1 text-right border rounded-lg"
                placeholder="0"
              />
            </div>
            <div class="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Jami summa:</span>
              <span class="text-indigo-600">{{ formatMoney(total) }}</span>
            </div>
          </div>

          <!-- Payment Buttons -->
          <div class="p-4 border-t space-y-2">
            <button @click="completeSale('CASH')" class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">
              Naqd to'lov
            </button>
            <button @click="completeSale('CARD')" class="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
              Karta orqali
            </button>
            <button @click="completeSale('DEBT')" class="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold">
              Qarzga berish
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { productsService, salesService } from '../services';

const router = useRouter();
const products = ref<any[]>([]);
const searchQuery = ref('');
const cart = ref<any[]>([]);
const discount = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);

const filteredProducts = computed(() => {
  if (!searchQuery.value) return products.value;
  return products.value.filter(p => p.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
});

const subtotal = computed(() => cart.value.reduce((sum, item) => sum + (item.price * item.quantity), 0));
const total = computed(() => Math.max(0, subtotal.value - discount.value));

const formatMoney = (amount: number) => new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';

const loadProducts = async () => {
  const result = await productsService.list({ page: 1, limit: 100 });
  products.value = result.data;
};

const handleSearch = () => {
  // Auto-focus search on mobile
};

const addToCart = (product: any) => {
  const existing = cart.value.find(item => item.product.id === product.id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.value.push({
      product,
      price: product.salePrice,
      quantity: 1
    });
  }
};

const updateQuantity = (index: number, delta: number) => {
  cart.value[index].quantity += delta;
  if (cart.value[index].quantity <= 0) {
    removeFromCart(index);
  }
};

const removeFromCart = (index: number) => {
  cart.value.splice(index, 1);
};

const clearCart = () => {
  if (confirm('Savatni tozalamoqchimisiz?')) {
    cart.value = [];
    discount.value = 0;
  }
};

const completeSale = async (paymentMethod: string) => {
  if (!cart.value.length) {
    alert('Savat bo\'sh');
    return;
  }

  try {
    const saleData = {
      items: cart.value.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        customUnitPrice: item.price
      })),
      notes: ''
    };

    const sale = await salesService.create(saleData);

    const paymentData = {
      payments: [{ amount: total.value, method: paymentMethod }],
      debtorName: paymentMethod === 'DEBT' ? 'Mijoz' : undefined,
      debtorPhone: paymentMethod === 'DEBT' ? '+998' : undefined
    };

    await salesService.complete(sale.id, paymentData);

    alert('Savdo muvaffaqiyatli yakunlandi!');
    cart.value = [];
    discount.value = 0;
    searchQuery.value = '';
    await loadProducts();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Xatolik yuz berdi');
  }
};

onMounted(() => {
  loadProducts();
  searchInput.value?.focus();
});
</script>