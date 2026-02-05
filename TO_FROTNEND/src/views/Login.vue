<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <div class="mx-auto h-16 w-16 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
          <svg class="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <h2 class="text-3xl font-bold text-gray-900">ERP Tizimi</h2>
        <p class="mt-2 text-sm text-gray-600">Hisobingizga kiring</p>
      </div>

      <div class="bg-white rounded-2xl shadow-xl p-8">
        <form @submit.prevent="handleLogin" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Foydalanuvchi nomi</label>
            <input
              v-model="form.username"
              type="text"
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="foydalanuvchi_nomi"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Parol</label>
            <input
              v-model="form.password"
              type="password"
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <div v-if="errorMessage" class="rounded-lg bg-red-50 border border-red-200 p-4">
            <p class="text-sm text-red-800">{{ errorMessage }}</p>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ isLoading ? 'Kirish...' : 'Kirish' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({ username: '', password: '' });
const errorMessage = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
  errorMessage.value = '';
  isLoading.value = true;

  try {
    await authStore.login(form.username, form.password);
    router.push(authStore.isAdmin ? '/dashboard' : '/sales');
  } catch (error: any) {
    if (error.response?.status === 401) {
      errorMessage.value = 'Foydalanuvchi nomi yoki parol noto\'g\'ri';
    } else {
      errorMessage.value = 'Xatolik yuz berdi. Qayta urinib ko\'ring';
    }
  } finally {
    isLoading.value = false;
  }
};
</script>