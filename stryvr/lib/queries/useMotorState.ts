import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { MotorState } from '../../types';

export const useMotorState = (userId: string, date?: string) => {
  return useQuery({
    queryKey: ['motorState', userId, date],
    queryFn: async (): Promise<MotorState | null> => {
      const { data, error } = await supabase
        .from('motor_states')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date || new Date().toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data || null;
    },
    enabled: !!userId,
  });
};