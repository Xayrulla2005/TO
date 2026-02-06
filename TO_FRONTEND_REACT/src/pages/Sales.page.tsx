import { useState } from 'react';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Search, ShoppingCart, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/shared/lib/utils';

export function SalesPage() {
  // Placeholder state logic to show UI interaction
  const [cart] = useState<{id: number, qty: number}[]>([{id: 1, qty: 2}]);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">
      {/* Left: Product Grid */}
      <Card className="flex-1 flex flex-col min-h-0 bg-gray-50 border-none shadow-none lg:bg-white lg:shadow-sm lg:border-gray-100">
        <div className="p-4 bg-white lg:rounded-t-2xl border-b border-gray-100 sticky top-0 z-10">
          <Input 
            placeholder="Search product by name or barcode..." 
            icon={<Search size={18} />} 
            autoFocus
            className="text-lg h-12"
          />
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
            {['All', 'Electronics', 'Food', 'Drinks', 'Home'].map(cat => (
              <button key={cat} className="px-4 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium hover:bg-indigo-600 hover:text-white transition-colors whitespace-nowrap">
                {cat}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div 
                key={i} 
                className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center text-gray-400">
                  <ShoppingCart size={32} className="opacity-20" />
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">Product Item {i}</h3>
                  <p className="text-indigo-600 font-bold mt-1">{formatCurrency(15000)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Right: Cart Panel */}
      <Card className="w-full lg:w-[420px] flex flex-col border-indigo-100 shadow-lg h-[40vh] lg:h-auto">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart size={20} /> Current Sale
          </h2>
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-sm font-bold">
            {cart.length} Items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map((item) => (
            <div key={item.id} className="flex gap-3 items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
              <div className="h-12 w-12 bg-gray-100 rounded-md flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">Product Name {item.id}</p>
                <p className="text-sm text-gray-500">{formatCurrency(15000)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600">-</button>
                <span className="font-bold w-4 text-center">{item.qty}</span>
                <button className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600">+</button>
              </div>
              <button className="text-red-400 hover:text-red-600 p-1">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {cart.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                <ShoppingCart size={48} className="opacity-20" />
                <p>Cart is empty</p>
             </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(30000)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax (0%)</span>
              <span>0 UZS</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>{formatCurrency(30000)}</span>
            </div>
          </div>
          <Button size="lg" className="w-full text-lg shadow-indigo-200 shadow-lg">
            Pay Now
          </Button>
        </div>
      </Card>
    </div>
  );
}