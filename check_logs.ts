const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

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