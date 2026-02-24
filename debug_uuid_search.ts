const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
    const targetId = '3335d3d4-17d8-4831-b746-f1c9dc4741c6'
    console.log(`Searching for ${targetId} in tickets columns...`)

    const { data: tickets } = await supabase.from('tickets').select('*')

    for (const t of tickets) {
        for (const [key, value] of Object.entries(t)) {
            if (typeof value === 'string' && value.includes(targetId)) {
                console.log(`FOUND MATCH in column ${key}:`, t)
            }
        }
    }
    console.log('Search finished.')
}

check()
