import { api } from '../../../shared/lib/axios';
import { User, LoginResponse } from '../../../shared/types/auth';

export const authApi = {
  login: (data: unknown) => api.post<LoginResponse>('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get<User>('/auth/me'),
};