// src/pages/UserPage.tsx
import { useState, useMemo } from 'react';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from '../features/User/hooks/userUser';
import { UserFormModal } from '../features/User/component/UserFormModal';
import { UsersTable } from '../features/User/component/UserTable';
import type { User } from '../features/User/types/user.types';

export const UsersPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(query) ||
        user.phone.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingUser) {
        await updateUser.mutateAsync({ id: editingUser.id, dto: data });
      } else {
        await createUser.mutateAsync(data);
      }
      // ✅ BUG 2 FIX: Muvaffaqiyatli bo'lganda modal yopiladi
      handleCloseModal();
    } catch (error) {
      // ✅ Xato bo'lsa modal ochiq qoladi, faqat log qilinadi
      console.error('Submit error:', error);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (
      window.confirm(
        `${user.fullName}ni ${user.isActive ? 'bloklashni' : 'faollashtirishni'} xohlaysizmi?`
      )
    ) {
      try {
        await updateUser.mutateAsync({
          id: user.id,
          dto: { isActive: !user.isActive },
        });
      } catch (error) {
        console.error('Toggle status error:', error);
      }
    }
  };

  const handleDelete = async (user: User) => {
    if (
      window.confirm(
        `${user.fullName}ni o'chirishga ishonchingiz komilmi? Bu amal qaytarilmaydi.`
      )
    ) {
      try {
        await deleteUser.mutateAsync(user.id);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-800">
              Foydalanuvchilar
            </h1>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              + Yangi foydalanuvchi qo'shish
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Ism yoki telefon bo'yicha qidirish..."
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              Yuklanmoqda...
            </div>
          ) : (
            <UsersTable
              users={filteredUsers}
              onEdit={handleOpenEditModal}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* ✅ Modal faqat isModalOpen=true bo'lganda render qilinadi */}
      <UserFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        user={editingUser}
        isLoading={createUser.isPending || updateUser.isPending}
      />
    </div>
  );
};