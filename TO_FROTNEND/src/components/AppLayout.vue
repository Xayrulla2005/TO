<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Mobile Header -->
    <div
      class="lg:hidden fixed top-0 left-0 right-0 bg-white border-b z-40 px-4 py-3"
    >
      <div class="flex items-center justify-between">
        <button
          @click="sidebarOpen = !sidebarOpen"
          class="p-2 rounded-lg hover:bg-gray-100"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <h1 class="text-lg font-semibold">ERP</h1>

        <div class="w-10"></div>
      </div>
    </div>

    <!-- Overlay -->
    <div
      v-if="sidebarOpen"
      @click="sidebarOpen = false"
      class="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
    ></div>

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed top-0 left-0 h-full bg-white border-r z-50 transition-transform lg:translate-x-0 lg:w-64',
        sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full',
      ]"
    >
      <div class="flex flex-col h-full">
        <div class="p-6 border-b">
          <h1 class="text-xl font-bold">ERP Tizimi</h1>
        </div>

        <nav class="flex-1 overflow-y-auto p-4 space-y-1">
          <router-link
            v-for="item in filteredNav"
            :key="item.path"
            :to="item.path"
            @click="sidebarOpen = false"
            class="flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors"
            :class="isActive(item.path) ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50 text-gray-700'"
          >
            <!-- ICON (SVG SAFE) -->
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <g v-html="item.icon"></g>
            </svg>

            <span class="font-medium">{{ item.label }}</span>
          </router-link>
        </nav>

        <div class="p-4 border-t">
          <div class="flex items-center space-x-3 mb-3">
            <div class="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
              <span class="font-semibold text-sm">{{ userInitials }}</span>
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">
                {{ authStore.user?.username || 'User' }}
              </p>

              <p class="text-xs text-gray-500">
                {{ authStore.user?.role === 'ADMIN' ? 'Administrator' : 'Sotuvchi' }}
              </p>
            </div>
          </div>

          <button
            @click="handleLogout"
            class="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            Chiqish
          </button>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="lg:ml-64 pt-16 lg:pt-0">
      <main class="p-4 lg:p-8">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

type NavItem = {
  path: string;
  label: string;
  icon: string;
  adminOnly: boolean;
};

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const sidebarOpen = ref(false);

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Boshqaruv paneli',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>`,
    adminOnly: true,
  },
  {
    path: '/products',
    label: 'Mahsulotlar',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>`,
    adminOnly: false,
  },
  {
    path: '/sales',
    label: 'Savdo',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>`,
    adminOnly: false,
  },
  {
    path: '/categories',
    label: 'Kategoriyalar',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>`,
    adminOnly: true,
  },
  {
    path: '/statistics',
    label: 'Statistika',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>`,
    adminOnly: true,
  },
];

const filteredNav = computed(() => {
  if (authStore.isAdmin) return navItems;
  return navItems.filter((i) => !i.adminOnly);
});

const userInitials = computed(() => {
  return authStore.user?.username?.substring(0, 2).toUpperCase() || 'U';
});

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/');
}

async function handleLogout() {
  if (!confirm('Tizimdan chiqmoqchimisiz?')) return;

  await authStore.logout();
  router.push('/login');
}
</script>
