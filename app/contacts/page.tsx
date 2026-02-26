"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { useRouter } from "next/navigation"

/* ─── Types ─── */

interface Message {
    id: number
    user_id: string
    role: string | null
    message: string | null
    created_at: string
}

interface Ticket {
    ticket_id: string
    user_email: string | null
    status: string | null
    ticket_number: string | null
}

interface Contact {
    name: string
    emails: string[]
    phones: string[]
    conversationIds: string[]
    totalMessages: number
    lastActive: string
    source: "ticket" | "chat"
}

/* ─── Extraction Helpers ─── */

/** Extract standard email addresses */
function extractStandardEmails(text: string): string[] {
    const matches = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g) || []
    return matches.map(e => e.toLowerCase())
}

/** Extract phonetic/spoken email addresses */
function extractPhoneticEmails(text: string): string[] {
    const results: string[] = []
    const lower = text.toLowerCase()

    // Patterns like: "name at the rate gmail dot com" / "name at gmail dot com"
    const patterns = [
        // "xyz at the rate gmail dot com" or "xyz at the range gmail dot com"
        /(\b[\w.]+)\s+at\s+(?:the\s+)?(?:rate|range|red)\s+([\w.]+)\s+dot\s+(\w+)/gi,
        // "xyz at gmail dot com"
        /(\b[\w.]+)\s+at\s+([\w.]+)\s+dot\s+(\w+)/gi,
        // "xyz at the rate gmail.com"
        /(\b[\w.]+)\s+at\s+(?:the\s+)?(?:rate|range|red)\s+([\w.]+\.\w+)/gi,
    ]

    for (const pattern of patterns) {
        let m
        while ((m = pattern.exec(lower)) !== null) {
            const local = m[1].replace(/\s+/g, "")
            if (m[3]) {
                // 3-part match: local @ domain . tld
                const domain = m[2].replace(/\s+/g, "")
                const tld = m[3].replace(/\s+/g, "")
                const email = `${local}@${domain}.${tld}`
                if (email.includes("@") && !email.includes(" ")) results.push(email)
            } else if (m[2]) {
                // 2-part match: local @ domain.tld
                const domain = m[2].replace(/\s+/g, "")
                const email = `${local}@${domain}`
                if (email.includes("@") && email.includes(".")) results.push(email)
            }
        }
    }

    return results
}

/** Extract phone numbers (10-15 digits, various formats) */
function extractPhones(text: string): string[] {
    const phones: string[] = []
    // Match: +91 12345 67890, (123) 456-7890, 1234567890, etc.
    const matches = text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}/g) || []
    for (const m of matches) {
        const digits = m.replace(/\D/g, "")
        if (digits.length >= 10 && digits.length <= 15) {
            phones.push(m.trim())
        }
    }
    return [...new Set(phones)]
}

/** Extract name from email address */
function nameFromEmail(email: string): string {
    const local = email.split("@")[0]
    return local
        .replace(/[._-]/g, " ")
        .replace(/\d+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 1)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ") || "Unknown"
}

/** Extract explicit name from user messages ("my name is...", "I am...", "this is...") */
function extractExplicitName(msgs: Message[]): string | null {
    for (const msg of msgs) {
        if (msg.role !== "user" || !msg.message) continue
        const patterns = [
            /my name is\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/i,
            /i(?:'m| am)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i,
            /this is\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:here|speaking|from)/i,
            /(?:call me|i go by)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
        ]
        for (const p of patterns) {
            const match = msg.message.match(p)
            if (match?.[1]) {
                const name = match[1].trim()
                const ignore = new Set(["interested", "looking", "calling", "writing", "reaching", "contacting",
                    "fine", "good", "okay", "here", "available", "ready", "not", "also", "just", "very",
                    "really", "quite", "happy", "glad", "frosty", "bot", "your", "the", "from", "using"])
                const words = name.split(/\s+/)
                if (words.some(w => ignore.has(w.toLowerCase()))) continue
                if (name.length < 3) continue
                return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
            }
        }
    }
    return null
}

/* ─── Component ─── */

export default function ContactsPage() {
    const router = useRouter()
    const [messages, setMessages] = useState<Message[]>([])
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [deletedEmails, setDeletedEmails] = useState<Set<string>>(new Set())

    // Custom cursor state
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [isHovering, setIsHovering] = useState(false)

    useEffect(() => {
        // Load deleted contacts from local storage
        try {
            const saved = localStorage.getItem("deleted_contacts")
            if (saved) setDeletedEmails(new Set(JSON.parse(saved)))
        } catch (e) {
            console.error("Failed to load deleted contacts", e)
        }

        // Custom cursor movement
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY })
        }
        window.addEventListener("mousemove", handleMouseMove)
        return () => window.removeEventListener("mousemove", handleMouseMove)
    }, [])

    const handleDeleteContact = (e: React.MouseEvent, email: string) => {
        e.stopPropagation()
        const newDeleted = new Set(deletedEmails)
        newDeleted.add(email)
        setDeletedEmails(newDeleted)
        localStorage.setItem("deleted_contacts", JSON.stringify(Array.from(newDeleted)))
    }

    /* ── Fetch all data ── */
    const fetchData = useCallback(async () => {
        // Fetch ALL messages (paginated)
        let allMsgs: Message[] = []
        let from = 0
        const PAGE = 1000
        let hasMore = true
        while (hasMore) {
            const { data, error } = await supabase
                .from("chat_logs")
                .select("*")
                .order("created_at", { ascending: true })
                .range(from, from + PAGE - 1)
            if (error || !data?.length) { hasMore = false; break }
            allMsgs = allMsgs.concat(data as Message[])
            from += PAGE
            if (data.length < PAGE) hasMore = false
        }
        setMessages(allMsgs)

        // Fetch all tickets
        const { data: tix } = await supabase.from("tickets").select("*")
        if (tix) setTickets(tix as Ticket[])

        setLoading(false)
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    /* ── Build contacts from ALL sources ── */
    const contacts: Contact[] = useMemo(() => {
        // Group messages by user_id
        const userMsgs = new Map<string, Message[]>()
        for (const msg of messages) {
            if (!msg.user_id?.trim()) continue
            if (!userMsgs.has(msg.user_id)) userMsgs.set(msg.user_id, [])
            userMsgs.get(msg.user_id)!.push(msg)
        }

        // Build email -> ticket map
        const ticketEmailSet = new Set<string>()
        for (const t of tickets) {
            if (t.user_email && !t.user_email.includes("@internal")) {
                ticketEmailSet.add(t.user_email.toLowerCase())
            }
        }

        // Primary key: email. Merge contacts across threads.
        const contactByEmail = new Map<string, Contact>()

        // Helper: merge an email into the contacts map
        const mergeContact = (
            email: string,
            name: string,
            phones: string[],
            userId: string,
            msgCount: number,
            lastActive: string,
            isTicket: boolean
        ) => {
            const key = email.toLowerCase()
            if (contactByEmail.has(key)) {
                const existing = contactByEmail.get(key)!
                if (!existing.conversationIds.includes(userId)) {
                    existing.conversationIds.push(userId)
                }
                existing.totalMessages += msgCount
                if (lastActive > existing.lastActive) existing.lastActive = lastActive
                for (const ph of phones) {
                    if (!existing.phones.includes(ph)) existing.phones.push(ph)
                }
                if (isTicket) existing.source = "ticket"
                // Prefer explicit name over email-derived name
                if (name !== "Unknown" && (existing.name === "Unknown" || existing.name.length < name.length)) {
                    existing.name = name
                }
            } else {
                contactByEmail.set(key, {
                    name,
                    emails: [email],
                    phones: [...phones],
                    conversationIds: [userId],
                    totalMessages: msgCount,
                    lastActive,
                    source: isTicket ? "ticket" : "chat",
                })
            }
        }

        // Process each conversation thread
        for (const [userId, msgs] of userMsgs) {
            const allText = msgs.map(m => m.message || "").join("\n")
            const lastMsg = msgs[msgs.length - 1]
            const lastActive = lastMsg.created_at

            // Extract ALL emails from messages
            const standardEmails = extractStandardEmails(allText)
            const phoneticEmails = extractPhoneticEmails(allText)
            const allEmails = [...new Set([...standardEmails, ...phoneticEmails])]
                .filter(e => !e.includes("@internal") && !e.includes("@example") && e.includes("."))

            // Extract phones
            const phones = extractPhones(allText)

            // Extract name
            const explicitName = extractExplicitName(msgs)

            if (allEmails.length > 0) {
                for (const email of allEmails) {
                    const name = explicitName || nameFromEmail(email)
                    const isTicket = ticketEmailSet.has(email.toLowerCase())
                    mergeContact(email, name, phones, userId, msgs.length, lastActive, isTicket)
                }
            }
            // If no email found in messages, check if tickets have one for this thread
            // (tickets are linked by user_email matching the conversation)
        }

        // Also add any ticket emails that might not be in the chat_logs
        for (const t of tickets) {
            if (t.user_email && !t.user_email.includes("@internal") && t.user_email.includes(".")) {
                const email = t.user_email.toLowerCase()
                if (!contactByEmail.has(email)) {
                    mergeContact(email, nameFromEmail(email), [], t.ticket_id, 0, "", true)
                }
            }
        }

        return Array.from(contactByEmail.values())
            .filter(c => c.emails[0] && !c.emails[0].includes("@internal"))
            .sort((a, b) => {
                // Sort by last active, then by message count
                if (b.lastActive && a.lastActive) {
                    return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
                }
                return b.totalMessages - a.totalMessages
            })
    }, [messages, tickets])

    /* ── Filtered ── */
    const filtered = useMemo(() => {
        if (!searchTerm) return contacts
        const q = searchTerm.toLowerCase()
        return contacts.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.emails.some(e => e.includes(q)) ||
            c.phones.some(p => p.includes(q)) ||
            c.conversationIds.some(id => id.toLowerCase().includes(q))
        )
    }, [contacts, searchTerm])

    // Filter out deleted contacts
    const activeContacts = useMemo(() => {
        return filtered.filter(c => !deletedEmails.has(c.emails[0]))
    }, [filtered, deletedEmails])

    function timeAgo(dateStr: string): string {
        if (!dateStr) return "—"
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return "Just now"
        if (mins < 60) return `${mins}m ago`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        const days = Math.floor(hrs / 24)
        if (days < 7) return `${days}d ago`
        return new Date(dateStr).toLocaleDateString()
    }

    /* ─── UI ─── */
    return (
        <div
            className="h-screen w-full overflow-y-auto overflow-x-hidden relative scroll-smooth bg-[#fafafa] text-slate-900"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Custom Cursor Overlay - Fixed Animation */}
            {isHovering && (
                <div
                    className="pointer-events-none fixed z-[100] rounded-full mix-blend-multiply transition-all duration-300 ease-out"
                    style={{
                        left: mousePos.x,
                        top: mousePos.y,
                        width: "48px",
                        height: "48px",
                        transform: "translate(-50%, -50%)",
                        border: "2px solid #ff5722",
                        backgroundColor: "rgba(255, 87, 34, 0.1)",
                        boxShadow: "0 0 15px rgba(255, 87, 34, 0.2)",
                    }}
                />
            )}

            {/* Trailing cursor dot */}
            {isHovering && (
                <div
                    className="pointer-events-none fixed z-[101] rounded-full bg-[#ff5722] transition-all duration-75 ease-out"
                    style={{
                        left: mousePos.x,
                        top: mousePos.y,
                        width: "8px",
                        height: "8px",
                        transform: "translate(-50%, -50%)",
                    }}
                />
            )}

            {/* Header */}
            <header
                className="sticky top-0 z-20 px-8 py-5 flex items-center justify-between bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm"
            >
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/")}
                        className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
                        title="Back to Dashboard"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3 text-slate-800">
                            <span
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg text-white"
                                style={{
                                    background: "linear-gradient(135deg, #ff7043 0%, #ff5722 100%)",
                                    boxShadow: "0 4px 14px 0 rgba(255, 87, 34, 0.39)",
                                }}
                            >
                                👥
                            </span>
                            Contacts
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5 ml-[52px]">
                            {activeContacts.length} active contacts from {messages.length} messages
                        </p>
                    </div>
                </div>

                <div style={{ position: "relative", width: 320 }}>
                    <svg
                        style={{
                            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                            width: 16, height: 16, color: "#94a3b8",
                        }}
                        fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                    >
                        <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search name, email, phone…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full py-2.5 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5722]/50 focus:border-[#ff5722] transition-shadow placeholder-slate-400"
                    />
                </div>
            </header>

            {/* Stats */}
            <div className="px-8 py-6 flex gap-4 flex-wrap bg-white border-b border-slate-200">
                {[
                    { label: "Total Contacts", value: contacts.length, color: "#ff5722", icon: "👥" },
                    { label: "With Phone", value: contacts.filter(c => c.phones.length > 0).length, color: "#0ea5e9", icon: "📱" },
                    { label: "From Tickets", value: contacts.filter(c => c.source === "ticket").length, color: "#f59e0b", icon: "🎫" },
                    { label: "Multi-Thread", value: contacts.filter(c => c.conversationIds.length > 1).length, color: "#8b5cf6", icon: "🔗" },
                ].map((s) => (
                    <div
                        key={s.label}
                        className="px-6 py-4 rounded-2xl flex items-center gap-4 bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-default"
                    >
                        <span className="text-2xl">{s.icon}</span>
                        <div>
                            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="px-8 py-8 max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                        <svg className="animate-spin mb-4" width={32} height={32} viewBox="0 0 24 24" fill="none">
                            <circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={3} opacity={0.2} />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="#ff5722" strokeWidth={3} strokeLinecap="round" />
                        </svg>
                        <span className="font-medium text-[#ff5722]">Scanning conversations for contacts…</span>
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contact Name</th>
                                        <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Address</th>
                                        <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                                        <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Threads</th>
                                        <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Messages</th>
                                        <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Last Active</th>
                                        <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Source</th>
                                        <th className="px-6 py-5"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {activeContacts.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-20 text-center text-slate-500">
                                                {searchTerm ? "No contacts match your search" : "No contacts found"}
                                            </td>
                                        </tr>
                                    ) : (
                                        activeContacts.map((c, i) => (
                                            <tr
                                                key={c.emails[0] + i}
                                                className="group relative transition-all duration-200 ease-in-out hover:bg-orange-50/50 cursor-pointer"
                                                style={{
                                                    animation: `fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.02}s both`,
                                                }}
                                                onClick={() => router.push(`/?search=${encodeURIComponent(c.emails[0])}`)}
                                            >
                                                {/* Name */}
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div
                                                            className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[15px] text-white flex-shrink-0 shadow-sm"
                                                            style={{
                                                                background: `linear-gradient(135deg, hsl(${(c.name.charCodeAt(0) * 13) % 40 + 10}, 85%, 60%) 0%, hsl(${(c.name.charCodeAt(0) * 13 + 20) % 40 + 10}, 95%, 50%) 100%)`, // Hues constrained to oranges/reds
                                                            }}
                                                        >
                                                            {c.name[0]?.toUpperCase() || "?"}
                                                        </div>
                                                        <span className="font-bold text-slate-800 text-[15px] group-hover:text-[#ff5722] transition-colors">
                                                            {c.name}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Email(s) */}
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-0.5">
                                                        {c.emails.slice(0, 2).map((e, j) => (
                                                            <span key={j} className="text-[13px] text-slate-600 font-medium group-hover:text-slate-800 transition-colors">{e}</span>
                                                        ))}
                                                        {c.emails.length > 2 && (
                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 w-fit mt-1">+{c.emails.length - 2} more</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Phone */}
                                                <td className="px-6 py-5">
                                                    {c.phones.length > 0 ? (
                                                        <div className="flex flex-col gap-1">
                                                            {c.phones.map((p, j) => (
                                                                <span key={j} className="text-[13px] text-slate-700 font-medium bg-slate-100 rounded-md px-2 py-1 flex items-center gap-1.5 w-fit">
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                                                    {p}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 font-medium italic">No phone</span>
                                                    )}
                                                </td>

                                                {/* Threads */}
                                                <td className="px-6 py-5">
                                                    <span className="text-[13px] font-black text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                                        {c.conversationIds.length}
                                                    </span>
                                                </td>

                                                {/* Messages */}
                                                <td className="px-6 py-5">
                                                    <span className="text-[13px] font-black text-[#ff5722] bg-[#ff5722]/10 px-3 py-1 rounded-full">
                                                        {c.totalMessages}
                                                    </span>
                                                </td>

                                                {/* Last Active */}
                                                <td className="px-6 py-5">
                                                    <span className="text-[13px] text-slate-500 font-medium flex items-center gap-1.5">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                        {timeAgo(c.lastActive)}
                                                    </span>
                                                </td>

                                                {/* Source */}
                                                <td className="px-6 py-5">
                                                    <span
                                                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border"
                                                        style={{
                                                            background: c.source === "ticket" ? "#fffbeb" : "#f1f5f9",
                                                            color: c.source === "ticket" ? "#d97706" : "#475569",
                                                            borderColor: c.source === "ticket" ? "#fcd34d" : "#cbd5e1",
                                                        }}
                                                    >
                                                        {c.source === "ticket" ? "Ticket" : "Chat"}
                                                    </span>
                                                </td>
                                                {/* Action / Delete */}
                                                <td className="px-6 py-5 w-[60px] text-right">
                                                    <button
                                                        onClick={(e) => handleDeleteContact(e, c.emails[0])}
                                                        className="opacity-0 group-hover:opacity-100 p-2.5 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all transform scale-90 group-hover:scale-100 border border-transparent hover:border-red-100"
                                                        title="Delete contact"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 mb-12 text-center text-xs text-slate-500 font-medium">
                            Showing {activeContacts.length} of {contacts.length} contacts
                        </div>
                    </>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />
        </div>
    )
}
