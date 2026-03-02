import { useState, useEffect } from 'react';
import { useSalesStore } from '../model/sales.store';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { formatCurrency } from '../../../shared/lib/utils';
import { Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../shared/lib/axios';

export function CartPanel() {
  const { cart, updateQty, removeFromCart, cartTotal, clearCart } = useSalesStore();
  const originalTotal = cartTotal();
  
  const [manualTotal, setManualTotal] = useState<number | null>(null);
  const finalTotal = manualTotal !== null ? manualTotal : originalTotal;
  const discount = originalTotal - finalTotal;

  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [debtAmount, setDebtAmount] = useState<number>(0);
  
  // Debt Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Auto-distribute single payment types for convenience
  useEffect(() => {
    setCashAmount(finalTotal);
    setCardAmount(0);
    setDebtAmount(0);
  }, [finalTotal]);

  const handlePaymentChange = (type: 'cash' | 'card', value: number) => {
    if (type === 'cash') {
      setCashAmount(value);
      // Auto adjust debt if needed, logic can be more complex based on reqs
    } else {
      setCardAmount(value);
    }
  };

  const { mutate: submitSale, isPending } = useMutation({
    mutationFn: async () => {
      // Validate totals
      if (cashAmount + cardAmount + debtAmount !== finalTotal) {
        throw new Error('Payment amounts do not match total');
      }
      if (debtAmount > 0 && (!customerName || !customerPhone)) {
        throw new Error('Customer details required for debt');
      }

      return api.post('/sales', {
        items: cart.map(i => ({ productId: i.id, qty: i.qty, price: i.salePrice })),
        total: finalTotal,
        originalTotal,
        discount,
        payments: { cash: cashAmount, card: cardAmount, debt: debtAmount },
        customer: debtAmount > 0 ? { name: customerName, phone: customerPhone } : null
      });
    },
    onSuccess: () => {
      alert('Sale completed!');
      clearCart();
      setManualTotal(null);
      setCustomerName('');
    },
    onError: (err) => alert(err)
  });

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cart.map((item) => (
          <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
            <div className="flex-1">
              <p className="font-medium text-gray-900">{item.name}</p>
              <p className="text-sm text-gray-500">{formatCurrency(item.salePrice)}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => updateQty(item.id, item.qty - 1)} className="p-1 hover:bg-gray-200 rounded">-</button>
              <span className="w-8 text-center font-medium">{item.qty}</span>
              <button onClick={() => updateQty(item.id, item.qty + 1)} className="p-1 hover:bg-gray-200 rounded">+</button>
              <button onClick={() => removeFromCart(item.id)} className="text-red-500 p-1"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Totals & Payment */}
      <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span>{formatCurrency(originalTotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-900">Total To Pay</span>
            <div className="flex items-center gap-2">
               {/* Override Total Logic */}
              <input 
                type="number" 
                className="w-24 text-right border rounded p-1 font-bold"
                value={manualTotal ?? originalTotal}
                onChange={(e) => setManualTotal(Number(e.target.value))}
              />
            </div>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}
        </div>

        {/* Payment Split */}
        <div className="grid grid-cols-2 gap-2">
          <Input 
            label="Cash" 
            type="number" 
            value={cashAmount} 
            onChange={(e) => handlePaymentChange('cash', Number(e.target.value))} 
          />
          <Input 
            label="Card" 
            type="number" 
            value={cardAmount} 
            onChange={(e) => handlePaymentChange('card', Number(e.target.value))} 
          />
        </div>
        
        {/* Calc Debt Automatically based on remaining */}
        <div className="flex justify-between items-center bg-red-50 p-2 rounded text-red-700">
          <span className="text-sm font-medium">Debt (Remaining)</span>
          <span className="font-bold">{formatCurrency(Math.max(0, finalTotal - cashAmount - cardAmount))}</span>
        </div>
        
        {/* Debt Logic Update */}
        {(() => {
           const debt = Math.max(0, finalTotal - cashAmount - cardAmount);
           if (debt !== debtAmount) setDebtAmount(debt); // Sync state for submission
           return debt > 0 ? (
             <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
               <Input placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
               <Input placeholder="Phone Number" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
             </div>
           ) : null;
        })()}

        <Button 
          className="w-full h-12 text-lg" 
          disabled={cart.length === 0 || isPending}
          onClick={() => submitSale()}
          isLoading={isPending}
        >
          Checkout
        </Button>
      </div>
    </div>
  );
}