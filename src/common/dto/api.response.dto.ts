export interface ApiSuccessResponse<T = unknown> {
  status: number;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  status: number;
  message: string;
  error?: string;
  details?: Record<string, string[]>;
  timestamp: string;
  traceId: string;
}
