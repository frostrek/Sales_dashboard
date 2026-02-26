const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function check() {
    console.log('\n=== CHECKING chat_logs TABLE ===')
    const { data: logs, error: logsErr } = await supabase
        .from('chat_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)

    if (logsErr) {
        console.error('chat_logs ERROR:', logsErr.code, logsErr.message, logsErr.hint)
    } else {
        console.log('chat_logs COLUMNS:', Object.keys(logs?.[0] ?? {}))
        console.log('chat_logs ROW COUNT (limit 3):', logs?.length)
        console.log('Sample row:', JSON.stringify(logs?.[0], null, 2))
    }

    console.log('\n=== CHECKING tickets TABLE ===')
    const { data: tickets, error: ticketsErr } = await supabase
        .from('tickets')
        .select('*')
        .limit(3)

    if (ticketsErr) {
        console.error('tickets ERROR:', ticketsErr.code, ticketsErr.message, ticketsErr.hint)
    } else {
        console.log('tickets COLUMNS:', Object.keys(tickets?.[0] ?? {}))
        console.log('tickets ROW COUNT (limit 3):', tickets?.length)
    }
}

check()
