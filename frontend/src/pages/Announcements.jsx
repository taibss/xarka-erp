import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import API from "../api"
import Layout from "../components/Layout"

export default function Announcements({ user }) {
    const [announcements, setAnnouncements] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ title: "", body: "" })
    const navigate = useNavigate()

    useEffect(() => {
        fetchAnnouncements()
    }, [])

    const fetchAnnouncements = () => {
        API.get("/announcements").then(r => setAnnouncements(r.data)).catch(() => {})
    }

    const handleLogout = () => {
        localStorage.removeItem("token")
        navigate("/")
    }

    const handleCreate = async () => {
        if (!form.title || !form.body) return
        await API.post("/announcements", form)
        setForm({ title: "", body: "" })
        setShowForm(false)
        fetchAnnouncements()
    }

    const handleMarkRead = async (id) => {
        await API.post(`/announcements/${id}/read`)
        fetchAnnouncements()
    }

    const handleDelete = async (id) => {
        await API.delete(`/announcements/${id}`)
        fetchAnnouncements()
    }

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: "40px 48px", maxWidth: "800px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                    <div>
                        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text)", marginBottom: "4px" }}>
                            Announcements
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
                            Company-wide updates and notices
                        </p>
                    </div>
                    {user?.role === "admin" && (
                        <button
                            onClick={() => setShowForm(!showForm)}
                            style={{
                                padding: "10px 20px",
                                borderRadius: "var(--radius-xs)",
                                border: "none",
                                background: "var(--accent)",
                                color: "#fff",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "600",
                                transition: "background 0.2s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"}
                            onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}
                        >
                            {showForm ? "Cancel" : "New Announcement"}
                        </button>
                    )}
                </div>

                {showForm && (
                    <div style={{
                        background: "var(--bg-card)",
                        borderRadius: "var(--radius)",
                        padding: "24px",
                        boxShadow: "var(--shadow-sm)",
                        border: "1px solid var(--border-light)",
                        marginBottom: "24px",
                    }}>
                        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "var(--text)" }}>New Announcement</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <input
                                placeholder="Title"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: "var(--radius-xs)",
                                    border: "1px solid var(--border)",
                                    background: "var(--bg-input)",
                                    color: "var(--text)",
                                    fontSize: "14px",
                                    outline: "none",
                                }}
                            />
                            <textarea
                                placeholder="Body"
                                value={form.body}
                                onChange={e => setForm({ ...form, body: e.target.value })}
                                rows={4}
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: "var(--radius-xs)",
                                    border: "1px solid var(--border)",
                                    background: "var(--bg-input)",
                                    color: "var(--text)",
                                    fontSize: "14px",
                                    outline: "none",
                                    resize: "vertical",
                                }}
                            />
                            <button
                                onClick={handleCreate}
                                style={{
                                    padding: "10px",
                                    borderRadius: "var(--radius-xs)",
                                    border: "none",
                                    background: "var(--accent)",
                                    color: "#fff",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    transition: "background 0.2s",
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"}
                                onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}
                            >
                                Post Announcement
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {announcements.map(a => (
                        <div
                            key={a.id}
                            onClick={() => !a.is_read && handleMarkRead(a.id)}
                            style={{
                                background: "var(--bg-card)",
                                borderRadius: "var(--radius)",
                                padding: "24px",
                                boxShadow: "var(--shadow-sm)",
                                border: `1px solid ${a.is_read ? "var(--border-light)" : "var(--info)"}`,
                                cursor: a.is_read ? "default" : "pointer",
                                transition: "all 0.2s",
                                position: "relative",
                            }}
                        >
                            {!a.is_read && (
                                <div style={{
                                    position: "absolute",
                                    top: "24px",
                                    left: "12px",
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background: "var(--info)",
                                }} />
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--text)" }}>{a.title}</h3>
                                {user?.role === "admin" && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "var(--text-muted)",
                                            cursor: "pointer",
                                            fontSize: "12px",
                                            padding: "4px 8px",
                                        }}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "12px" }}>
                                {a.body}
                            </p>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                By {a.created_by} · {fmtDate(a.created_at)}
                            </div>
                        </div>
                    ))}
                    {announcements.length === 0 && (
                        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px" }}>No announcements yet</p>
                    )}
                </div>
            </div>
        </Layout>
    )
}
