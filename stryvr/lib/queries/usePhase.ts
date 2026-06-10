import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Phase } from '../../types';

export const usePhase = (userId: string) => {
  return useQuery({
    queryKey: ['phase', userId],
    queryFn: async (): Promise<Phase | null> => {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!userId,
  });
};