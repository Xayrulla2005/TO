import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '../stores/auth';

import LoginView from '../views/Login.vue';
import DashboardView from '../views/Dashboard.vue';
import ProductsView from '../views/Product.vue';
import SalesView from '../views/Sales.vue';
import CategoriesView from '../views/Categories.vue';
import StatisticsView from '../views/Statistics.vue';
import AppLayout from '../components/AppLayout.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: LoginView,
      meta: { title: 'Kirish - ERP Tizimi', guest: true },
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard' },

        {
          path: 'dashboard',
          name: 'Dashboard',
          component: DashboardView,
          meta: { title: 'Boshqaruv paneli', requiresAdmin: true },
        },
        {
          path: 'products',
          name: 'Products',
          component: ProductsView,
          meta: { title: 'Mahsulotlar' },
        },
        {
          path: 'sales',
          name: 'Sales',
          component: SalesView,
          meta: { title: 'Savdo' },
        },
        {
          path: 'categories',
          name: 'Categories',
          component: CategoriesView,
          meta: { title: 'Kategoriyalar', requiresAdmin: true },
        },
        {
          path: 'statistics',
          name: 'Statistics',
          component: StatisticsView,
          meta: { title: 'Statistika', requiresAdmin: true },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
});

router.beforeEach(async (
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const authStore = useAuthStore();

  document.title = (to.meta.title as string) || 'ERP Tizimi';

  if (to.meta.guest) {
    if (authStore.isAuthenticated) return next('/dashboard');
    return next();
  }

  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      return next({ name: 'Login', query: { redirect: to.fullPath } });
    }

    if (!authStore.user) {
      try {
        await authStore.fetchProfile();
      } catch {
        await authStore.logout();
        return next({ name: 'Login' });
      }
    }

    if (to.meta.requiresAdmin && !authStore.isAdmin) {
      return next('/sales');
    }

    return next();
  }

  next();
});

export default router;
