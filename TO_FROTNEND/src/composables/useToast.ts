// ============================================================
// src/composables/useToast.ts - GLOBAL NOTIFICATION SYSTEM
// ============================================================
import { ref, h, render } from 'vue';
import Toast from '../components/Toast.vue';

interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  position?: 'top-right' | 'top-center' | 'bottom-right';
}

const toasts = ref<any[]>([]);

export function useToast() {
  const show = (options: ToastOptions) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const vnode = h(Toast, {
      ...options,
      onClose: () => {
        render(null, container);
        document.body.removeChild(container);
        toasts.value = toasts.value.filter(t => t !== vnode);
      },
    });

    render(vnode, container);
    toasts.value.push(vnode);
  };

  const success = (message: string, title?: string, duration?: number) => {
    show({ type: 'success', message, title, duration });
  };

  const error = (message: string, title?: string, duration?: number) => {
    show({ type: 'error', message, title, duration });
  };

  const warning = (message: string, title?: string, duration?: number) => {
    show({ type: 'warning', message, title, duration });
  };

  const info = (message: string, title?: string, duration?: number) => {
    show({ type: 'info', message, title, duration });
  };

  const clear = () => {
    toasts.value = [];
  };

  return {
    show,
    success,
    error,
    warning,
    info,
    clear,
  };
}

// Global instance for use in non-component contexts
export const toast = {
  success: (message: string, title?: string, duration?: number) => {
    useToast().success(message, title, duration);
  },
  error: (message: string, title?: string, duration?: number) => {
    useToast().error(message, title, duration);
  },
  warning: (message: string, title?: string, duration?: number) => {
    useToast().warning(message, title, duration);
  },
  info: (message: string, title?: string, duration?: number) => {
    useToast().info(message, title, duration);
  },
};