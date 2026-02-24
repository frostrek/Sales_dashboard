import { supabase } from './app/lib/supabase'

async function check() {
  const { data, error } = await supabase
    .from('chat_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

check()
