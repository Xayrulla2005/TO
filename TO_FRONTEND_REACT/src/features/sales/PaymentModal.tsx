// src/features/sales/components/PaymentModal.tsx
import { useState, useEffect } from 'react';
import { toast } from '@/shared/ui/Toast';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;  // Buni qo'shing (yoki grandTotal o'rniga)
  items?: {              // Agar items kerak bo'lsa
    productId: string;
    qty: number;
    unitPrice: number;
  }[];
  onConfirm: (paymentData: PaymentData) => void;
  isSubmitting?: boolean;
}

export interface PaymentData {
  cashAmount: number;
  cardAmount: number;
  debtAmount: number;
  customerName?: string;
  customerPhone?: string;
}

export function PaymentModal({ isOpen, onClose, totalAmount, onConfirm }: PaymentModalProps) {
  const [cashAmount, setCashAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const debtAmount = totalAmount - cashAmount - cardAmount;
  const hasDebt = debtAmount > 0;

  // Agar qarz bo'lsa, customer form'ni ko'rsat
  useEffect(() => {
    setShowCustomerForm(hasDebt);
  }, [hasDebt]);

  const handleQuickCash = (amount: number) => {
    setCashAmount(amount);
    setCardAmount(0);
  };

  const handleConfirm = () => {
    if (hasDebt && (!customerName.trim() || !customerPhone.trim())) {
      toast.error('Qarzga savdo qilish uchun ism va telefon kiritish shart!');
      return;
    }

    onConfirm({
      cashAmount,
      cardAmount,
      debtAmount,
      customerName: hasDebt ? customerName : undefined,
      customerPhone: hasDebt ? customerPhone : undefined,
    });
  };

  if (!isOpen) return null;

  const paymentStatus = debtAmount === 0 ? 'PAID' : 'PARTIAL';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Complete Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Total Amount */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Jami summa</div>
            <div className="text-3xl font-bold text-blue-900">
              UZS {totalAmount.toLocaleString()}
            </div>
          </div>

          {/* Quick Cash Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Cash
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[50000, 100000, 200000, 500000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleQuickCash(amount)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                >
                  {amount / 1000}K
                </button>
              ))}
            </div>
          </div>

          {/* Cash Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cash Amount
            </label>
            <input
              type="number"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={cashAmount || ''}
              onChange={(e) => setCashAmount(Number(e.target.value))}
              placeholder="Naqd pul miqdori"
            />
          </div>

          {/* Card Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Card Amount
            </label>
            <input
              type="number"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={cardAmount || ''}
              onChange={(e) => setCardAmount(Number(e.target.value))}
              placeholder="Karta orqali to'lov"
            />
          </div>

          {/* Customer Info (agar qarz bo'lsa) */}
          {showCustomerForm && (
            <div className="space-y-4 bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700 font-medium">
                <span>⚠️</span>
                <span>Qarzga savdo - Mijoz ma'lumotlarini kiriting</span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mijoz ismi *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="To'liq ism"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon raqami *
                </label>
                <input
                  type="tel"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+998 XX XXX XX XX"
                />
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="space-y-2 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Cash:</span>
              <span className="font-medium">UZS {cashAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card:</span>
              <span className="font-medium">UZS {cardAmount.toLocaleString()}</span>
            </div>
            {hasDebt && (
              <div className="flex justify-between text-sm">
                <span className="text-red-600 flex items-center gap-1">
                  <span>⚠️</span> Qarz:
                </span>
                <span className="font-medium text-red-600">
                  UZS {debtAmount.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-medium">Payment Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                paymentStatus === 'PAID' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {paymentStatus === 'PAID' ? 'TO\'LIQ' : 'QISMAN'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Confirm Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}