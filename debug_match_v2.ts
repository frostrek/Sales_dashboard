const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
    const { data: tickets } = await supabase.from('tickets').select('*')
    const { data: logs } = await supabase.from('chat_logs').select('user_id').limit(1000)

    const logIds = new Set(logs.map(l => l.user_id).filter(id => id && id.startsWith('UID-')))

    console.log(`Checking ${logIds.size} unique log IDs against ${tickets.length} tickets...`)

    for (const logId of logIds) {
        const uuidPart = logId.replace('UID-', '')

        const match = tickets.find(t => t.user_id === uuidPart || t.ticket_id === uuidPart)
        if (match) {
            console.log(`MATCH! Log ID ${logId} matches ticket ${match.ticket_number} (by ${match.user_id === uuidPart ? 'user_id' : 'ticket_id'})`)
        }
    }
}

check()
