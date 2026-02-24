import { supabase } from './app/lib/supabase'

async function check() {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Columns:', Object.keys(data[0] || {}))
  }
}

check()
