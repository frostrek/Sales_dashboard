"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { supabase } from "./lib/supabase"
import { useAuth } from "./lib/AuthContext"
import { useRouter } from "next/navigation"

/* ─── Types ─── */

interface ConversationPreview {
  user_id: string
  latest_message: string | null
  latest_time: string
  message_count: number
  user_email: string | null
  ticket_number: string | null
  status: string | null
  ticket_id: string | null
  all_tickets?: Ticket[]
}

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

/* ─── Helpers ─── */

function timeAgo(dateStr: string): string {
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

function truncate(str: string | null, len: number): string {
  if (!str) return ""
  return str.length > len ? str.slice(0, len) + "…" : str
}

function getMessageText(msg: Message): string {
  return msg.message || ""
}

function extractEmailsFromText(text: string): string[] {
  const matches = text.match(/[\w.-]+@[\w.-]+\.\w+/g)
  return matches ? Array.from(new Set(matches)) : []
}

/* ─── Snowflake Component ─── */

function Snowflakes() {
  const [flakes, setFlakes] = useState<{ id: number; style: React.CSSProperties }[]>([])

  useEffect(() => {
    // Generate 20 static flakes
    const newFlakes = Array.from({ length: 20 }).map((_, i) => {
      const duration = 5 + Math.random() * 10
      const delay = Math.random() * 5
      const size = 10 + Math.random() * 15
      const left = Math.random() * 100
      const drift = Math.random() > 0.5 ? "snowfall" : "snowfall-drift"

      return {
        id: i,
        style: {
          left: `${left}vw`,
          fontSize: `${size}px`,
          animation: `${drift} ${duration}s linear ${delay}s infinite`,
          opacity: Math.random() * 0.7 + 0.3,
        },
      }
    })
    setFlakes(newFlakes)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {flakes.map((flake) => (
        <div key={flake.id} className="snowflake" style={flake.style}>
          ❄
        </div>
      ))}
    </div>
  )
}

/* ─── Dashboard ─── */

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<ConversationPreview[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [tickets, setTickets] = useState<Map<string, Ticket>>(new Map())
  const [filterTab, setFilterTab] = useState<"all" | "new" | "resolved">("all")
  const [replyText, setReplyText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  /* ── Fetch tickets ── */

  const fetchTickets = useCallback(async () => {
    const { data } = await supabase
      .from("tickets")
      .select("ticket_id, user_email, status, ticket_number")

    if (data) {
      const map = new Map<string, Ticket>()
      for (const t of data) {
        map.set(t.ticket_id, t as Ticket)
      }
      setTickets(map)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  /* ── Fetch ALL messages and build conversation list ── */

  const fetchAllMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_logs")
      .select("*")
      .order("created_at", { ascending: true })

    if (error || !data) {
      setLoading(false)
      return
    }

    const messages = data as Message[]
    setAllMessages(messages)

    // Build conversation previews
    const convMap = new Map<
      string,
      { msgs: Message[]; latest: string; emails: Set<string> }
    >()

    for (const msg of messages) {
      const uid = msg.user_id
      if (!uid || uid.trim() === "") continue

      if (!convMap.has(uid)) {
        convMap.set(uid, { msgs: [], latest: msg.created_at, emails: new Set() })
      }
      const entry = convMap.get(uid)!
      entry.msgs.push(msg)
      if (msg.created_at > entry.latest) entry.latest = msg.created_at

      const text = msg.message || ""
      const emails = extractEmailsFromText(text)
      emails.forEach(e => entry.emails.add(e))
    }

    const previews: ConversationPreview[] = Array.from(convMap.entries())
      .map(([uid, info]) => {
        const lastMsg = info.msgs[info.msgs.length - 1]

        // Find matching tickets
        const matchedTickets: Ticket[] = []
        const foundTicketIds = new Set<string>()

        const checkMatch = (email: string) => {
          const matching = Array.from(tickets.values()).filter(t => t.user_email === email)
          matching.forEach(t => {
            if (!foundTicketIds.has(t.ticket_id)) {
              matchedTickets.push(t)
              foundTicketIds.add(t.ticket_id)
            }
          })
        }

        // 1. Check for specific emails extracted from messages
        for (const email of Array.from(info.emails)) {
          checkMatch(email)
        }

        // 2. Fallback: Check for internal user_id email
        const internalEmail = `user_${uid}@internal`
        checkMatch(internalEmail)

        const bestEmail = matchedTickets.length > 0 ? (matchedTickets[0].user_email || internalEmail) : (Array.from(info.emails)[0] || internalEmail)
        const primaryTicket = matchedTickets[0]

        return {
          user_id: uid,
          latest_message: getMessageText(lastMsg),
          latest_time: info.latest,
          message_count: info.msgs.length,
          user_email: bestEmail,
          ticket_number: primaryTicket?.ticket_number ?? null,
          status: primaryTicket?.status ?? "open",
          ticket_id: primaryTicket?.ticket_id ?? null,
          all_tickets: matchedTickets
        }
      })
      .sort((a, b) => new Date(b.latest_time).getTime() - new Date(a.latest_time).getTime())

    setConversations(previews)
    setLoading(false)
  }, [tickets])

  useEffect(() => {
    fetchAllMessages()
  }, [fetchAllMessages])

  /* ── Select conversation ── */

  function selectConversation(userId: string) {
    setSelectedId(userId)
    setLoadingMessages(true)

    const msgs = allMessages
      .filter((m) => m.user_id === userId)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )

    setThreadMessages(msgs)
    setLoadingMessages(false)
  }

  /* ── Realtime subscription ── */

  useEffect(() => {
    const channel = supabase
      .channel("db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_logs",
        },
        () => fetchAllMessages()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        () => fetchTickets()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAllMessages, fetchTickets])

  // Refresh thread when selected
  useEffect(() => {
    if (!selectedId) return
    const msgs = allMessages
      .filter((m) => m.user_id === selectedId)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    setThreadMessages(msgs)
  }, [allMessages, selectedId])

  /* ── Auto-scroll ── */

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [threadMessages])

  /* ── Send Reply ── */

  async function sendReply() {
    if (!selectedId || !replyText.trim() || isSending) return
    setIsSending(true)

    const { error } = await supabase
      .from("chat_logs")
      .insert({
        user_id: selectedId,
        message: replyText.trim(),
        role: "assistant",
        created_at: new Date().toISOString()
      })

    if (!error) {
      setReplyText("")
    }
    setIsSending(false)
  }

  /* ── Update Ticket Status ── */

  async function toggleStatus() {
    if (!selectedConv || isUpdatingStatus) return
    setIsUpdatingStatus(true)
    const currentStatus = selectedConv.status || "open"
    const newStatus = currentStatus === "resolved" ? "open" : "resolved"

    console.log(`Toggling status for ${selectedConv.user_id} from ${currentStatus} to ${newStatus}`)

    try {
      if (selectedConv.ticket_id) {
        console.log(`Updating existing ticket: ${selectedConv.ticket_id}`)
        const { error } = await supabase
          .from("tickets")
          .update({ status: newStatus })
          .eq("ticket_id", selectedConv.ticket_id)

        if (error) throw error
        console.log("Ticket updated successfully")
      } else {
        console.log(`Creating new ticket for unticketed thread: ${selectedConv.user_id}`)
        const { error } = await supabase
          .from("tickets")
          .insert({
            user_email: selectedConv.user_email || `user_${selectedConv.user_id}@internal`,
            status: newStatus,
            ticket_number: `ST-${Math.floor(1000 + Math.random() * 9000)}`
          })

        if (error) throw error
        console.log("New ticket created successfully")
      }
      await fetchTickets()
    } catch (error: any) {
      console.error("Error toggling status:", error)
      alert(`Failed to update status: ${error.message || "Unknown error"}`)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  /* ── Search filter ── */

  const filteredConversations = useMemo(() => {
    let list = conversations

    // Status filter
    if (filterTab === "new") {
      list = list.filter(c => c.status === "open" || !c.status)
    } else if (filterTab === "resolved") {
      list = list.filter(c => c.status === "resolved")
    }

    const q = searchTerm.toLowerCase()
    if (!q) return list
    return list.filter(
      (c) =>
        c.user_id?.toLowerCase().includes(q) ||
        c.user_email?.toLowerCase().includes(q) ||
        c.latest_message?.toLowerCase().includes(q) ||
        c.ticket_number?.toLowerCase().includes(q) ||
        c.ticket_id?.toLowerCase().includes(q) ||
        c.all_tickets?.some(t =>
          t.ticket_number?.toLowerCase().includes(q) ||
          t.ticket_id?.toLowerCase().includes(q)
        )
    )
  }, [searchTerm, conversations, filterTab])

  /* ── Auto-select exact match ── */

  useEffect(() => {
    if (!searchTerm) return
    const q = searchTerm.toLowerCase().trim()

    // Find exact match for ticket_number or ticket_id across all linked tickets
    const exactMatch = conversations.find(
      (c) =>
        c.ticket_number?.toLowerCase() === q ||
        c.ticket_id?.toLowerCase() === q ||
        c.all_tickets?.some(t =>
          t.ticket_number?.toLowerCase() === q ||
          t.ticket_id?.toLowerCase() === q
        )
    )

    if (exactMatch && exactMatch.user_id !== selectedId) {
      selectConversation(exactMatch.user_id)
    }
  }, [searchTerm, conversations, selectedId])

  /* ── Selected conversation info ── */

  const selectedConv = useMemo(
    () => conversations.find((c) => c.user_id === selectedId) ?? null,
    [conversations, selectedId]
  )

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#0a1120" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <span className="text-slate-400 font-medium tracking-wide">Authenticating...</span>
        </div>
      </div>
    )
  }

  /* ─────────────────── UI ─────────────────── */

  return (
    <div className="flex h-screen overflow-hidden">
      <Snowflakes />

      {/* ═══════════ SIDEBAR ═══════════ */}
      <aside
        className="flex flex-col frost-sidebar"
        style={{
          width: 370,
          minWidth: 300,
          borderRight: "1px solid var(--sidebar-border)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-5 relative z-10">
          <div
            className="frost-logo"
            style={{
              width: 42,
              height: 42,
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "#fff",
              fontSize: 18,
              boxShadow: "0 0 20px var(--frost-glow)",
            }}
          >
            F
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.2px",
                textShadow: "0 0 10px rgba(130, 180, 255, 0.3)",
              }}
            >
              Frostrek LLP
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--sidebar-text-muted)",
              }}
            >
              Sales Conversations
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pb-4 relative z-10">
          <div style={{ position: "relative" }}>
            <svg
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                width: 16,
                height: 16,
                color: "var(--sidebar-text-muted)",
                zIndex: 2,
              }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx={11} cy={11} r={8} />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search by ID or email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="frost-search"
              style={{
                width: "100%",
                padding: "12px 12px 12px 42px",
                background: "var(--sidebar-surface)",
                border: "1px solid var(--sidebar-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--sidebar-text)",
                fontSize: 13,
                outline: "none",
                backdropFilter: "blur(4px)",
              }}
            />
          </div>
        </div>

        <div className="px-4 pb-3 flex gap-1 relative z-10">
          {(["all", "new", "resolved"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              style={{
                flex: 1,
                padding: "6px 0",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: "var(--radius-sm)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                background: filterTab === tab ? "var(--sidebar-surface-active)" : "transparent",
                color: filterTab === tab ? "#fff" : "var(--sidebar-text-muted)",
                border: "none",
                cursor: "pointer",
                transition: "var(--transition)"
              }}
            >
              {tab === "new" ? "New Queries" : tab}
            </button>
          ))}
        </div>

        {/* Conversation count */}
        <div
          className="px-6 pb-2 relative z-10"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--sidebar-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            opacity: 0.8,
          }}
        >
          {filteredConversations.length} Conversation
          {filteredConversations.length !== 1 ? "s" : ""}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 relative z-10">
          {loading ? (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--sidebar-text-muted)", fontSize: 13 }}
            >
              <div className="flex items-center gap-2">
                <svg className="animate-spin" width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={3} opacity={0.25} />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
                </svg>
                Fetching data…
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--sidebar-text-muted)", fontSize: 13 }}
            >
              No conversations found
            </div>
          ) : (
            filteredConversations.map((conv, idx) => {
              const isActive = selectedId === conv.user_id
              return (
                <div
                  key={conv.user_id}
                  onClick={() => selectConversation(conv.user_id)}
                  className={`animate-slide-in-left conv-card ${isActive ? "active" : ""}`}
                  style={{
                    padding: "14px 16px",
                    marginBottom: 6,
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    background: isActive
                      ? "var(--sidebar-surface-active)"
                      : "transparent",
                    transition: "all 0.2s ease",
                    border: isActive
                      ? "1px solid rgba(130,180,255,0.2)"
                      : "1px solid transparent",
                    animationDelay: `${idx * 40}ms`,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "var(--sidebar-surface-hover)"
                      e.currentTarget.style.borderColor = "rgba(130,180,255,0.1)"
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent"
                      e.currentTarget.style.borderColor = "transparent"
                    }
                  }}
                >
                  {/* Top row: ID + count badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex flex-col">
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isActive ? "#fff" : "var(--sidebar-text)",
                          fontFamily: "var(--font-mono, monospace)",
                          textShadow: isActive ? "0 0 8px rgba(130,180,255,0.4)" : "none",
                        }}
                      >
                        {truncate(conv.user_id, 16)}
                      </span>
                      {conv.all_tickets && conv.all_tickets.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {conv.all_tickets.map((t, i) => (
                            <span key={t.ticket_id} style={{ fontSize: 10, color: isActive ? "rgba(255,255,255,0.6)" : "var(--sidebar-text-muted)", fontWeight: 700 }}>
                              #{t.ticket_number}{i < conv.all_tickets!.length - 1 ? "," : ""}
                            </span>
                          ))}
                        </div>
                      ) : (
                        conv.ticket_number && (
                          <span style={{ fontSize: 10, color: isActive ? "rgba(255,255,255,0.6)" : "var(--sidebar-text-muted)", fontWeight: 700 }}>
                            #{conv.ticket_number}
                          </span>
                        )
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="frost-badge">
                        {conv.message_count} msg{conv.message_count !== 1 ? "s" : ""}
                      </span>
                      {conv.status && (
                        <span style={{
                          fontSize: 8,
                          padding: "1px 5px",
                          borderRadius: 4,
                          background: conv.status === "open" ? "var(--status-open-bg)" : "var(--status-closed-bg)",
                          color: conv.status === "open" ? "var(--status-open-text)" : "var(--status-closed-text)",
                          textTransform: "uppercase",
                          fontWeight: 800
                        }}>
                          {conv.status === "resolved" ? "resolved" : "new query"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Email if found */}
                  {conv.user_email && (
                    <p
                      style={{
                        margin: "0 0 5px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: isActive
                          ? "#fff"
                          : "var(--accent-light)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>✉</span> {conv.user_email}
                    </p>
                  )}

                  {/* Preview */}
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: 12,
                      color: isActive
                        ? "rgba(255,255,255,0.7)"
                        : "var(--sidebar-text-muted)",
                      lineHeight: 1.4,
                    }}
                  >
                    {truncate(conv.latest_message, 55) || "No messages yet"}
                  </p>

                  {/* Time */}
                  <div className="flex items-center gap-1.5"
                    style={{
                      fontSize: 11,
                      color: isActive
                        ? "rgba(255,255,255,0.5)"
                        : "rgba(123, 160, 201, 0.6)",
                    }}
                  >
                    <span>Clock icon</span> {timeAgo(conv.latest_time)}
                  </div>
                </div>
              )
            })
          )}
        </div>
        {/* User Info & Actions */}
        <div className="px-5 mt-auto pb-6 relative z-10">
          <div
            className="p-4 rounded-2xl flex items-center justify-between"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)"
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-indigo-500/20">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white mb-0.5 truncate w-32">{user?.email}</p>
                <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                  {user?.role === 'admin' ? (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Admin</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">Sales</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {user?.role === 'admin' && (
                <button
                  onClick={() => router.push("/admin")}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400"
                  title="Admin Panel"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-slate-400 hover:text-red-400"
                title="Sign Out"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ═══════════ MAIN PANEL ═══════════ */}
      <main
        className="flex-1 flex flex-col frost-panel"
      >
        {selectedId && selectedConv ? (
          <>
            {/* Header */}
            <header className="flex items-center justify-between px-8 py-5 frost-header relative z-10">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--panel-text)",
                    }}
                  >
                    {selectedConv.ticket_number ? `Ticket #${selectedConv.ticket_number}` : "Conversation"}
                  </h2>
                  <button
                    onClick={toggleStatus}
                    disabled={isUpdatingStatus}
                    className={`status-btn ${selectedConv.status === "resolved" ? "reopen" : "resolve"}`}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: 12,
                      fontWeight: 700,
                      border: "none",
                      cursor: isUpdatingStatus ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.2s ease",
                      background: selectedConv.status === "resolved" ? "rgba(100, 116, 139, 0.1)" : "var(--accent)",
                      color: selectedConv.status === "resolved" ? "var(--panel-text)" : "#fff",
                      opacity: isUpdatingStatus ? 0.7 : 1
                    }}
                  >
                    {isUpdatingStatus ? (
                      "Updating..."
                    ) : selectedConv.status === "resolved" ? (
                      <>
                        <span style={{ fontSize: 14 }}>↺</span> Re-open Query
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 14 }}>✓</span> Mark as Resolved
                      </>
                    )}
                  </button>
                </div>
                <div
                  className="flex flex-wrap items-center gap-4"
                  style={{ fontSize: 12, color: "var(--panel-text-muted)" }}
                >
                  <span className="flex items-center gap-1.5">
                    <strong>ID:</strong>{" "}
                    <span style={{ fontFamily: "monospace", background: "rgba(0,0,0,0.04)", padding: "1px 4px", borderRadius: 4 }}>
                      {selectedConv.user_id}
                    </span>
                  </span>
                  {selectedConv.user_email && (
                    <span className="flex items-center gap-1.5">
                      <strong>Email:</strong>
                      <span style={{ color: "var(--accent)" }}>{selectedConv.user_email}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="frost-stat" style={{ padding: "6px 16px", borderRadius: "99px" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--panel-text)" }}>
                  {threadMessages.length} message{threadMessages.length !== 1 ? "s" : ""}
                </span>
              </div>
            </header>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-8 py-6 relative z-0"
              style={{ scrollBehavior: "smooth" }}
            >
              {loadingMessages ? (
                <div
                  className="flex items-center justify-center h-full"
                  style={{ color: "var(--panel-text-muted)", fontSize: 14 }}
                >
                  <div className="animate-pulse flex flex-col items-center gap-2">
                    <span style={{ fontSize: 24 }}>❄</span>
                    Loading conversation…
                  </div>
                </div>
              ) : threadMessages.length === 0 ? (
                <div
                  className="flex items-center justify-center h-full"
                  style={{ color: "var(--panel-text-muted)", fontSize: 14 }}
                >
                  No messages in this conversation
                </div>
              ) : (
                <div className="flex flex-col gap-5 pb-8">
                  {threadMessages.map((msg, idx) => {
                    const role = (msg.role || "").toLowerCase()
                    const isUser = role === "user" || !role
                    const text = getMessageText(msg)

                    if (!text) return null

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        {!isUser && (
                          <div
                            className="frost-logo"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: 700,
                              marginRight: 10,
                              marginTop: 4,
                              flexShrink: 0,
                              boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)"
                            }}
                          >
                            F
                          </div>
                        )}
                        <div
                          className={`msg-bubble ${isUser ? "user" : "assistant"}`}
                        >
                          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                            {text}
                          </p>
                          <div className="msg-time">
                            {new Date(msg.created_at).toLocaleString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Reply Box */}
            <div className="px-8 py-4 frost-header" style={{ borderTop: "1px solid var(--panel-border)", background: "rgba(255,255,255,0.8)" }}>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Type a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                  disabled={isSending}
                  className="frost-search"
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    background: "#fff",
                    border: "1px solid var(--panel-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 14,
                    outline: "none"
                  }}
                />
                <button
                  onClick={sendReply}
                  disabled={isSending || !replyText.trim()}
                  className="frost-logo"
                  style={{
                    padding: "0 24px",
                    borderRadius: "var(--radius-md)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    border: "none",
                    cursor: "pointer",
                    opacity: isSending || !replyText.trim() ? 0.6 : 1,
                    transition: "var(--transition)"
                  }}
                >
                  {isSending ? "..." : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 relative z-10">
            <div
              className="frost-empty-icon"
              style={{
                width: 96,
                height: 96,
                borderRadius: "24px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.8), rgba(255,255,255,0.4))",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: "0 10px 40px rgba(120, 180, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width={40}
                height={40}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>

            <div style={{ textAlign: "center" }}>
              <h3
                style={{
                  margin: "0 0 6px",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--panel-text)",
                  letterSpacing: "-0.5px",
                }}
              >
                Select a conversation
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  color: "var(--panel-text-muted)",
                  maxWidth: 300,
                  lineHeight: 1.5,
                }}
              >
                Choose a conversation from the sidebar to view the full thread history
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <div className="frost-stat">
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "var(--accent)",
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {conversations.length}
                </div>
                <div style={{ fontSize: 12, color: "var(--panel-text-muted)", fontWeight: 500 }}>
                  Active Threads
                </div>
              </div>
              <div className="frost-stat">
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "var(--accent)",
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {allMessages.length}
                </div>
                <div style={{ fontSize: 12, color: "var(--panel-text-muted)", fontWeight: 500 }}>
                  Total Messages
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
