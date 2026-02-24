const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
    const { data: tickets } = await supabase.from('tickets').select('user_id, ticket_number, ticket_id')
    const { data: logs } = await supabase.from('chat_logs').select('user_id').limit(100)

    const logIds = new Set(logs.map(l => l.user_id))

    console.log('Unique Log User IDs:', Array.from(logIds).slice(0, 5))

    for (const ticket of tickets) {
        const strippedId = `UID-${ticket.user_id}`
        if (logIds.has(strippedId)) {
            console.log(`MATCH FOUND! Ticket ${ticket.ticket_number} (user_id: ${ticket.user_id}) matches Log User ID ${strippedId}`)
        }

        // Also check if ticket_id matches
        const strippedTicketId = `UID-${ticket.ticket_id}`
        if (logIds.has(strippedTicketId)) {
            console.log(`MATCH FOUND! Ticket ID ${ticket.ticket_id} matches Log User ID ${strippedTicketId}`)
        }
    }
}

check()
