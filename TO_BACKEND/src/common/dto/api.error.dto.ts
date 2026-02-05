export interface ApiErrorResponse {
  status: number;
  message: string;
  error: string;
  details?: Record<string, string[]>;
  timestamp: string;
  traceId: string;
}
