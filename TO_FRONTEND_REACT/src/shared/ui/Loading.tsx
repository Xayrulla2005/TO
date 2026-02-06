import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className="flex items-center justify-center p-4">
      <Loader2 className={cn("h-8 w-8 animate-spin text-indigo-600", className)} />
    </div>
  );
}

export function Skeleton({ className, count = 1 }: { className?: string; count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className={cn("animate-pulse rounded-md bg-gray-200", className)} 
        />
      ))}
    </div>
  );
}