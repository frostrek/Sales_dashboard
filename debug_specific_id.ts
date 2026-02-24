const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
    const idsToSearch = [
        '3335d3d4-17d8-4831-b741-f1c9dc4741c6', // Strip UID-
        '85bb1898-52d9-4104-9160-04d9bb9d45a9'
    ]

    for (const id of idsToSearch) {
        console.log(`Searching for ${id}...`)
        const { data: byUserId } = await supabase.from('tickets').select('*').eq('user_id', id)
        if (byUserId && byUserId.length > 0) console.log(`Found as user_id:`, byUserId)

        const { data: byTicketId } = await supabase.from('tickets').select('*').eq('ticket_id', id)
        if (byTicketId && byTicketId.length > 0) console.log(`Found as ticket_id:`, byTicketId)
    }
}

check()
