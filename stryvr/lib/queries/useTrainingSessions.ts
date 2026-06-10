import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { TrainingSession } from '../../types';

export const useTrainingSessions = (userId: string, limit = 10) => {
  return useQuery({
    queryKey: ['trainingSessions', userId, limit],
    queryFn: async (): Promise<TrainingSession[]> => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
};