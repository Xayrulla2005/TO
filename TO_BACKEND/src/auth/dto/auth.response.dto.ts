export class AuthResponseDto {
  accessToken!: string;
  expiresIn!: number;
  user!: {
    id: string;
    username: string;
    email: string;
    role: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  refreshToken?: string;
}