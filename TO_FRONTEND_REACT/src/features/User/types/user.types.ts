export type UserRole = 'ADMIN' | 'SALER';

export type User = {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export type CreateUserDto = {
  fullName: string;
  phone: string;
  password: string;
  role?: UserRole;
  isActive?: boolean;
};

export type UpdateUserDto = {
  fullName?: string;
  phone?: string;
  role?: UserRole;
  isActive?: boolean;
};
