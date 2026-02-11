// src/pages/CustomersPage.tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users, Phone } from "lucide-react";

import { debtsApi } from "../features/debts/api/debts.api";
import type { Debt } from "../shared/types/debt.types";

import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/Card";
import { Input } from "../shared/ui/Input";
import { Button } from "../shared/ui/Button";
import { Modal } from "../shared/ui/Modal";
import { toast } from "../shared/ui/Toast";
import { formatCurrency, safeNumber } from "../shared/lib/utils";

type PaymentMethod = "CASH" | "CARD";

export function CustomersPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  const [payAmount, setPayAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["debts", search],
    queryFn: () =>
      debtsApi.getAll({
        page: 1,
        limit: 50,
        search: search.trim() ? search.trim() : undefined,
      }),
  });

  const debts = data?.data ?? [];

  const filteredDebts = useMemo(() => {
    // backend search ham bor, lekin frontendda ham qo‘shimcha filter
    if (!search.trim()) return debts;
    const s = search.trim().toLowerCase();
    return debts.filter(
      (d) =>
        d.debtorName.toLowerCase().includes(s) ||
        d.debtorPhone.toLowerCase().includes(s)
    );
  }, [debts, search]);

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDebt) throw new Error("Debt not selected");

      const amount = Number(payAmount);

      if (!amount || amount <= 0) {
        throw new Error("To‘lov summasi noto‘g‘ri");
      }

      return debtsApi.makePayment(selectedDebt.id, {
        amount,
        paymentMethod,
        note: note.trim() ? note.trim() : undefined,
      });
    },
    onSuccess: async () => {
      toast.success("To‘lov qabul qilindi");
      setSelectedDebt(null);
      setPayAmount("");
      setPaymentMethod("CASH");
      setNote("");

      await qc.invalidateQueries({ queryKey: ["debts"] });
    },
    onError: (e: any) => {
      toast.error(e?.message || "To‘lovda xatolik");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mijozlar (Qarzlar)</h1>
          <p className="text-gray-500">
            Qarzdor mijozlar va qarzni yopish jarayoni
          </p>
        </div>

        <div className="w-full md:w-80">
          <Input
            placeholder="Ism yoki telefon bo‘yicha qidirish..."
            icon={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Qarzdorlar ro‘yxati</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-gray-500">Yuklanmoqda...</div>
          ) : filteredDebts.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Qarzdor mijozlar topilmadi
              </h3>
              <p className="text-gray-500">
                Hozircha qarzlar bazada mavjud emas.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredDebts.map((d) => {
                const remaining = safeNumber(d.remainingAmount);
                const original = safeNumber(d.originalAmount);

                return (
                  <div
                    key={d.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-gray-900">
                        {d.debtorName}
                      </div>

                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <Phone size={16} />
                        {d.debtorPhone}
                      </div>

                      <div className="text-sm text-gray-500">
                        Umumiy:{" "}
                        <span className="font-medium text-gray-800">
                          {formatCurrency(original)}
                        </span>
                        {" • "}
                        Qoldiq:{" "}
                        <span className="font-bold text-red-600">
                          {formatCurrency(remaining)}
                        </span>
                      </div>

                      <div className="text-xs text-gray-400">
                        Status: {d.status}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        disabled={remaining <= 0}
                        onClick={() => {
                          setSelectedDebt(d);
                          setPayAmount(String(Math.min(remaining, remaining)));
                          setPaymentMethod("CASH");
                          setNote("");
                        }}
                      >
                        To‘lash
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PAYMENT MODAL */}
      <Modal
        isOpen={!!selectedDebt}
        onClose={() => setSelectedDebt(null)}
        title="Qarz to‘lash"
      >
        {selectedDebt && (
          <div className="space-y-4">
            <div className="bg-gray-50 border rounded-lg p-3">
              <div className="font-semibold text-gray-900">
                {selectedDebt.debtorName}
              </div>
              <div className="text-sm text-gray-500">
                Qoldiq:{" "}
                <span className="font-bold text-red-600">
                  {formatCurrency(safeNumber(selectedDebt.remainingAmount))}
                </span>
              </div>
            </div>

            <Input
              label="To‘lov summasi"
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                To‘lov turi
              </div>

              <div className="flex gap-2">
                <Button
                  variant={paymentMethod === "CASH" ? "primary" : "secondary"}
                  onClick={() => setPaymentMethod("CASH")}
                  type="button"
                >
                  Naqd
                </Button>

                <Button
                  variant={paymentMethod === "CARD" ? "primary" : "secondary"}
                  onClick={() => setPaymentMethod("CARD")}
                  type="button"
                >
                  Karta
                </Button>
              </div>
            </div>

            <Input
              label="Izoh (ixtiyoriy)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setSelectedDebt(null)}
                type="button"
              >
                Bekor qilish
              </Button>

              <Button
                onClick={() => payMutation.mutate()}
                disabled={payMutation.isPending}
                type="button"
              >
                {payMutation.isPending ? "Yuborilmoqda..." : "To‘lovni saqlash"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
