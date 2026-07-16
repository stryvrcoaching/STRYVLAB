import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function check() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const service = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await service
    .from('exercise_translations')
    .insert([{ exerciseId: 'test-slug', lang: 'ES', name: 'Test' }])
    .select()

  console.log('Error:', error)
  
  if (!error) {
    await service.from('exercise_translations').delete().eq('exerciseId', 'test-slug')
  }
}
check()
