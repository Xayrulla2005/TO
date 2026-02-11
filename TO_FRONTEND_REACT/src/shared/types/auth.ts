export type Role = "ADMIN" | "SALER";

export interface User {
  id: string;
  fullName: string;
  phone: string;
  role: Role;
  isActive: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}
