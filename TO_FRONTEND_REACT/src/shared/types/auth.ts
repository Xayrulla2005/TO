export type Role = 'ADMIN' | 'SALER';

export interface User {
  id: string;
  username: string;
  role: Role;
  name: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}