import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../features/auth/api/auth.api';
import { useAuthStore } from '../features/auth/model/auth.store';
import { toast } from '../shared/ui/Toast';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  fullName: z.string().min(1, 'To\'liq ism kiritilishi shart'),
  password: z.string().min(6, 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (res) => {
      console.log('✅ Login muvaffaqiyatli:', res); // Debug
      
      // ✅ Token va user saqlanadi
      login(res.data.user, res.data.accessToken);
      
      toast.success('Xush kelibsiz!');
      
      console.log('🚀 Dashboard ga yo\'naltirilmoqda...'); // Debug
      
      // ✅ Dashboard ga yo'naltirish
      navigate('/dashboard', { replace: true });
      
      console.log('✅ Navigate chaqirildi'); // Debug
    },
    onError: (error: any) => {
      console.error('❌ Login xatosi:', error); // Debug
      toast.error('Ism yoki parol noto\'g\'ri');
    }
  });

  const onSubmit = (data: LoginForm) => {
    console.log('📤 Login ma\'lumotlari yuborilmoqda:', data); // Debug
    mutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Xush kelibsiz</h1>
          <p className="text-gray-500 mt-2">Royxatdan otdingiz</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">To'liq ism</label>
            <input
              {...register('fullName')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Masalan: Xayrulla Aliyev"
            />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Parol</label>
            <input
              type="password"
              {...register('password')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : 'Kirish'}
          </button>
        </form>
      </div>
    </div>
  );
}