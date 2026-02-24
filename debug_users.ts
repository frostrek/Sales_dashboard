const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(5)

    if (error) {
        console.error('Error:', error)
    } else {
        console.log('Sample Users:', JSON.stringify(data, null, 2))
        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]))
        }
    }
}

check()
