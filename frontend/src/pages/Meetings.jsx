import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import API from "../api"
import Layout from "../components/Layout"
import { HiCalendar, HiClock, HiClipboardDocumentList, HiUser } from "react-icons/hi2"

export default function Meetings({ user }) {
    const [meetings, setMeetings] = useState([])
    const [employees, setEmployees] = useState([])
    const [selected, setSelected] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ title: "", agenda: "", meeting_time: "", duration_minutes: 60, attendee_ids: [] })
    const [notesForm, setNotesForm] = useState({ notes: "", action_items: "" })
    const [showNotes, setShowNotes] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        fetchMeetings()
        API.get("/employees").then(r => setEmployees(r.data)).catch(() => {})
    }, [])

    const fetchMeetings = () => {
        API.get("/meetings").then(r => setMeetings(r.data)).catch(() => {})
    }

    const handleLogout = () => {
        localStorage.removeItem("token")
        navigate("/")
    }

    const handleCreate = async () => {
        if (!form.title || !form.meeting_time) return
        await API.post("/meetings", {
            ...form,
            meeting_time: new Date(form.meeting_time).toISOString(),
        })
        setForm({ title: "", agenda: "", meeting_time: "", duration_minutes: 60, attendee_ids: [] })
        setShowForm(false)
        fetchMeetings()
    }

    const handleAddNotes = async () => {
        if (!notesForm.notes) return
        const payload = { notes: notesForm.notes }
        if (notesForm.action_items) {
            payload.action_items = notesForm.action_items.split("\n").filter(i => i.trim())
        }
        await API.put(`/meetings/${selected.id}/notes`, payload)
        setNotesForm({ notes: "", action_items: "" })
        setShowNotes(false)
        fetchMeetings()
    }

    const handleDelete = async (id) => {
        await API.delete(`/meetings/${id}`)
        setSelected(null)
        fetchMeetings()
    }

    const toggleAttendee = (id) => {
        setForm(prev => ({
            ...prev,
            attendee_ids: prev.attendee_ids.includes(id)
                ? prev.attendee_ids.filter(i => i !== id)
                : [...prev.attendee_ids, id]
        }))
    }

    const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—"

    const now = new Date()
    const upcoming = meetings.filter(m => new Date(m.meeting_time) >= now)
    const past = meetings.filter(m => new Date(m.meeting_time) < now)

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: "40px 48px", display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: "24px" }}>
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                        <div>
                            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text)", marginBottom: "4px" }}>Meetings</h1>
                            <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>Schedule and manage meetings</p>
                        </div>
                        <button
                            onClick={() => setShowForm(!showForm)}
                            style={{
                                padding: "10px 20px", borderRadius: "var(--radius-xs)", border: "none",
                                background: "var(--accent)", color: "#fff", cursor: "pointer",
                                fontSize: "14px", fontWeight: "600", transition: "background 0.2s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"}
                            onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}
                        >
                            {showForm ? "Cancel" : "New Meeting"}
                        </button>
                    </div>

                    {showForm && (
                        <div style={{
                            background: "var(--bg-card)", borderRadius: "var(--radius)", padding: "24px",
                            boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)", marginBottom: "24px",
                        }}>
                            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "var(--text)" }}>New Meeting</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                    style={{ padding: "10px 14px", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: "14px", outline: "none" }} />
                                <input placeholder="Agenda" value={form.agenda} onChange={e => setForm({ ...form, agenda: e.target.value })}
                                    style={{ padding: "10px 14px", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: "14px", outline: "none" }} />
                                <input type="datetime-local" value={form.meeting_time} onChange={e => setForm({ ...form, meeting_time: e.target.value })}
                                    style={{ padding: "10px 14px", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: "14px", outline: "none" }} />
                                <input type="number" placeholder="Duration (minutes)" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })}
                                    style={{ padding: "10px 14px", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: "14px", outline: "none" }} />
                                <div>
                                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>Attendees</p>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                        {employees.map(emp => (
                                            <button key={emp.id} onClick={() => toggleAttendee(emp.id)}
                                                style={{
                                                    padding: "6px 12px", borderRadius: "99px", border: "none", cursor: "pointer",
                                                    background: form.attendee_ids.includes(emp.id) ? "var(--accent)" : "var(--bg-input)",
                                                    color: form.attendee_ids.includes(emp.id) ? "#fff" : "var(--text-secondary)",
                                                    fontSize: "12px", fontWeight: "500", transition: "all 0.2s",
                                                }}>
                                                {emp.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={handleCreate}
                                    style={{ padding: "10px", borderRadius: "var(--radius-xs)", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: "600", transition: "background 0.2s" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}>
                                    Create Meeting
                                </button>
                            </div>
                        </div>
                    )}

                    {upcoming.length > 0 && (
                        <>
                            <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "var(--text)" }}>Upcoming</h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
                                {upcoming.map(m => (
                                    <div key={m.id} onClick={() => setSelected(m)}
                                        style={{
                                            background: selected?.id === m.id ? "var(--info-bg)" : "var(--bg-card)",
                                            borderRadius: "var(--radius-sm)", padding: "16px", cursor: "pointer",
                                            border: `1px solid ${selected?.id === m.id ? "var(--info)" : "var(--border-light)"}`,
                                            transition: "all 0.2s",
                                        }}>
                                        <div style={{ fontWeight: "600", fontSize: "15px", color: "var(--text)", marginBottom: "4px" }}>{m.title}</div>
                                        <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{fmtDateTime(m.meeting_time)} · {m.duration_minutes}min</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {past.length > 0 && (
                        <>
                            <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "var(--text)" }}>Past</h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {past.map(m => (
                                    <div key={m.id} onClick={() => setSelected(m)}
                                        style={{
                                            background: selected?.id === m.id ? "var(--info-bg)" : "var(--bg-card)",
                                            borderRadius: "var(--radius-sm)", padding: "16px", cursor: "pointer",
                                            border: `1px solid ${selected?.id === m.id ? "var(--info)" : "var(--border-light)"}`,
                                            transition: "all 0.2s", opacity: 0.7,
                                        }}>
                                        <div style={{ fontWeight: "600", fontSize: "15px", color: "var(--text)", marginBottom: "4px" }}>{m.title}</div>
                                        <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{fmtDateTime(m.meeting_time)} · {m.duration_minutes}min</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {selected && (
                    <div style={{
                        background: "var(--bg-card)", borderRadius: "var(--radius)", padding: "28px",
                        boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)", height: "fit-content", position: "sticky", top: "40px",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                            <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text)" }}>Details</h3>
                            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}>×</button>
                        </div>
                        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text)", marginBottom: "12px" }}>{selected.title}</h2>
                        <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}><HiCalendar size={14} /> {fmtDateTime(selected.meeting_time)}</div>
                        <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}><HiClock size={14} /> {selected.duration_minutes} minutes</div>
                        <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}><HiClipboardDocumentList size={14} /> {selected.agenda || "No agenda"}</div>
                        <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}><HiUser size={14} /> {selected.created_by?.name}</div>

                        <div style={{ marginBottom: "16px" }}>
                            <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "8px" }}>Attendees</p>
                            {selected.attendees?.map(a => (
                                <div key={a.id} style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "4px 0" }}>{a.name}</div>
                            ))}
                        </div>

                        {selected.notes && (
                            <div style={{ marginBottom: "16px" }}>
                                <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "8px" }}>Notes</p>
                                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>{selected.notes}</p>
                            </div>
                        )}

                        {user?.id === selected.created_by?.id && (
                            <>
                                {!showNotes ? (
                                    <button onClick={() => setShowNotes(true)}
                                        style={{
                                            padding: "8px 16px", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)",
                                            background: "var(--bg-card)", color: "var(--text)", cursor: "pointer", fontSize: "13px", fontWeight: "500",
                                            width: "100%", marginBottom: "8px", transition: "all 0.2s",
                                        }}>
                                        Add Notes
                                    </button>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" }}>
                                        <textarea placeholder="Meeting notes" value={notesForm.notes} onChange={e => setNotesForm({ ...notesForm, notes: e.target.value })}
                                            rows={3} style={{ padding: "8px 12px", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: "13px", outline: "none", resize: "vertical" }} />
                                        <textarea placeholder="Action items (one per line)" value={notesForm.action_items} onChange={e => setNotesForm({ ...notesForm, action_items: e.target.value })}
                                            rows={2} style={{ padding: "8px 12px", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: "13px", outline: "none", resize: "vertical" }} />
                                        <button onClick={handleAddNotes}
                                            style={{ padding: "8px", borderRadius: "var(--radius-xs)", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                                            Save Notes
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {(user?.id === selected.created_by?.id || user?.role === "admin") && (
                            <button onClick={() => handleDelete(selected.id)}
                                style={{
                                    padding: "8px 16px", borderRadius: "var(--radius-xs)", border: "1px solid var(--error)",
                                    background: "transparent", color: "var(--error)", cursor: "pointer", fontSize: "13px", fontWeight: "500",
                                    width: "100%", transition: "all 0.2s",
                                }}>
                                Delete Meeting
                            </button>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    )
}
