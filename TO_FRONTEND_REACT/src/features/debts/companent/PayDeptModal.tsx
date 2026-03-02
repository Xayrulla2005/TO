// src/features/debts/components/PayDebtModal.tsx
import { useState } from 'react';
import { useDebt, usePayDebt } from '../hooks/useDebts';
import { LoadingSpinner } from '../../../shared/ui/Loading';
import { toast } from '@/shared/ui/Toast';

interface PayDebtModalProps {
  debtId: string;
  onClose: () => void;
}

export function PayDebtModal({ debtId, onClose }: PayDebtModalProps) {
  const { data: debt, isLoading } = useDebt(debtId);
  const payDebt = usePayDebt();
  
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');

  const handleSubmit = async () => {
    if (amount <= 0 || !debt) return;

    if (amount > debt.remainingAmount) {
      toast.error('To\'lov miqdori qarzdan ko\'p bo\'lishi mumkin emas!');
      return;
    }

    await payDebt.mutateAsync({
      id: debtId,
      dto: { amount, paymentMethod },
    });
    
    onClose();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!debt) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Qarz To'lash</h2>
          <p className="text-sm text-gray-500 mt-1">{debt.customerName}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Debt Info */}
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm text-red-600">Qoldiq qarz</div>
            <div className="text-2xl font-bold text-red-900">
              {debt.remainingAmount.toLocaleString()} UZS
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To'lov miqdori
            </label>
            <input
              type="number"
              max={debt.remainingAmount}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="To'lov miqdorini kiriting"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To'lov usuli
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`px-4 py-2 rounded-md border ${
                  paymentMethod === 'CASH'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Naqd
              </button>
              <button
                onClick={() => setPaymentMethod('CARD')}
                className={`px-4 py-2 rounded-md border ${
                  paymentMethod === 'CARD'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Karta
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">To'lov:</span>
              <span className="font-medium">{amount.toLocaleString()} UZS</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Yangi qoldiq:</span>
              <span className="font-medium text-red-600">
                {(debt.remainingAmount - amount).toLocaleString()} UZS
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleSubmit}
              disabled={amount <= 0 || payDebt.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {payDebt.isPending ? 'Saqlanmoqda...' : 'To\'lash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}