// API types for STRYVR
// Supabase integration

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface DateRangeParams {
  startDate: string;
  endDate: string;
}

// Query hook return types
export interface UseQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseMutationResult<T, V> {
  mutate: (variables: V) => void;
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
}