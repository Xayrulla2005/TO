// src/features/User/component/UserFormModal.tsx
import { useState, useEffect } from "react";
import type { User, UserRole } from "../types/user.types";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  user?: User | null;
  isLoading?: boolean;
}

export const UserFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  user,
  isLoading,
}: UserFormModalProps) => {
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    password: "",
    role: "SALER" as UserRole,
    isActive: true,
  });

  const [showPassword, setShowPassword] = useState(false); // ✅ YUQORIGA KO'TARILDI

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName,
        phone: user.phone,
        password: "",
        role: user.role,
        isActive: user.isActive,
      });
    } else {
      setFormData({
        fullName: "",
        phone: "",
        password: "",
        role: "SALER",
        isActive: true,
      });
    }
  }, [user, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  // ✅ Telefon validatsiyasi
  const phoneRegex = /^\+998\d{9}$/;
  if (!phoneRegex.test(formData.phone)) {
    alert('Telefon raqami noto\'g\'ri formatda!\nTo\'g\'ri format: +998901234567');
    return;
  }

  // ✅ Parol validatsiyasi (yangi user uchun)
  if (!user && formData.password.length < 6) {
    alert('Parol kamida 6 ta belgidan iborat bo\'lishi kerak!');
    return;
  }

  if (user) {
    const { password, ...updateData } = formData;
    onSubmit(updateData);
  } else {
    onSubmit(formData);
  }
};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              {user
                ? "Foydalanuvchini tahrirlash"
                : "Yangi foydalanuvchi qo'shish"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              type="button"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4"
          autoComplete="off"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To'liq ism
            </label>
            <input
              type="text"
              name="fullname"
              required
              autoComplete="off"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefon
            </label>
            <input
              type="tel"
              name="userphone"
              required
              autoComplete="off"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.phone}
              onChange={(e) => {
                // ✅ Faqat raqamlarni qabul qilish
                let value = e.target.value.replace(/[^\d+]/g, "");

                // ✅ Agar +998 yo'q bo'lsa, avtomatik qo'shish
                if (value && !value.startsWith("+998")) {
                  if (value.startsWith("998")) {
                    value = "+" + value;
                  } else {
                    value = "+998" + value;
                  }
                }

                // ✅ Maksimal uzunlik: +998 + 9 raqam = 13
                if (value.length <= 13) {
                  setFormData({ ...formData, phone: value });
                }
              }}
              placeholder="+998901234567"
              maxLength={13}
            />
            <p className="text-xs text-gray-500 mt-1">Format: +998XXXXXXXXX</p>
            {/* Validation error ko'rsatish */}
          </div>

          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parol
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="new-password"
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? "Yashir" : "Ko'r"}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              name="userrole"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as UserRole })
              }
            >
              <option value="SALER">SALER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          {user && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
              />
              <label
                htmlFor="isActive"
                className="ml-2 text-sm font-medium text-gray-700"
              >
                Faol
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
