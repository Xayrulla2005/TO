import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ✅ cn funksiyasi - Tailwind class larni merge qilish uchun
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined): string {
  // Safe conversion to number
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  
  // Check if valid number
  if (isNaN(num) || !isFinite(num)) {
    return 'UZS 0';
  }
  
  return `UZS ${num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// Add safe number helper
export function safeNumber(value: unknown): number {
  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : 0;
  }
  return 0;
}