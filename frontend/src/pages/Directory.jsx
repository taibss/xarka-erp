import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import API from "../api"
import Layout from "../components/Layout"
import { HiMagnifyingGlass, HiPhone } from "react-icons/hi2"

const fmt = (dt) => {
    if (!dt) return '--'
    const match = String(dt).match(/(\d{2}):(\d{2})/)
    if (!match) return '--'
    let hour = parseInt(match[1], 10)
    const minute = match[2]
    const period = hour >= 12 ? 'PM' : 'AM'
    hour = hour % 12
    if (hour === 0) hour = 12
    const hourStr = String(hour).padStart(2, '0')
    return `${hourStr}:${minute} ${period}`
}
const fmtHours = (h) => {
    if (h == null) return '--'
    const totalMinutes = Math.round(h * 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}h ${minutes}m`
}

export default function Directory({ user }) {
    const [employees, setEmployees] = useState([])
    const [search, setSearch] = useState("")
    const [filter, setFilter] = useState("All")
    const [selected, setSelected] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        API.get("/directory").then(r => setEmployees(r.data)).catch(e => {
            console.error("Failed to load directory:", e)
        })
    }, [])

    const handleLogout = () => {
        localStorage.removeItem("token")
        navigate("/")
    }

    const statusColor = (status) => {
        if (status === "In Office") return "var(--success)"
        if (status === "On Leave") return "var(--warning)"
        return "var(--text-muted)"
    }

    const statusBg = (status) => {
        if (status === "In Office") return "var(--success-bg)"
        if (status === "On Leave") return "var(--warning-bg)"
        return "#f5f5f5"
    }

    const filtered = employees.filter(e => {
        const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
            (e.department || "").toLowerCase().includes(search.toLowerCase())
        const matchFilter = filter === "All" || e.status === filter
        return matchSearch && matchFilter
    })

    const filterCounts = {
        All: employees.length,
        "In Office": employees.filter(e => e.status === "In Office").length,
        "On Leave": employees.filter(e => e.status === "On Leave").length,
        Out: employees.filter(e => e.status === "Out").length,
    }

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: "40px 48px", display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: "24px" }}>
                <div>
                    {/* Header */}
                    <div style={{ marginBottom: "32px" }}>
                        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text)", marginBottom: "4px" }}>
                            Employee Directory
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
                            Find and connect with your team
                        </p>
                    </div>

                    {/* Search and Filter */}
                    <div style={{ marginBottom: "24px" }}>
                        <input
                            placeholder="Search by name or department..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "12px 16px",
                                borderRadius: "var(--radius-xs)",
                                border: "1px solid var(--border)",
                                background: "var(--bg-input)",
                                color: "var(--text)",
                                fontSize: "14px",
                                outline: "none",
                                transition: "border 0.2s",
                                marginBottom: "16px",
                            }}
                            onFocus={e => e.target.style.borderColor = "var(--accent)"}
                            onBlur={e => e.target.style.borderColor = "var(--border)"}
                        />
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {["All", "In Office", "On Leave", "Out"].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "99px",
                                        border: "none",
                                        cursor: "pointer",
                                        background: filter === f ? "var(--accent)" : "var(--bg-card)",
                                        color: filter === f ? "#fff" : "var(--text-secondary)",
                                        fontSize: "13px",
                                        fontWeight: "500",
                                        boxShadow: "var(--shadow-sm)",
                                        border: `1px solid ${filter === f ? "var(--accent)" : "var(--border-light)"}`,
                                        transition: "all 0.2s",
                                    }}
                                >
                                    {f} <span style={{
                                        display: "inline-block",
                                        marginLeft: "6px",
                                        padding: "1px 6px",
                                        borderRadius: "99px",
                                        background: filter === f ? "rgba(255,255,255,0.25)" : "var(--bg-input)",
                                        fontSize: "11px",
                                        fontWeight: "600",
                                    }}>
                                        {filterCounts[f]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Results count */}
                    <div style={{ marginBottom: "16px", fontSize: "13px", color: "var(--text-muted)" }}>
                        Showing {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
                        {filter !== "All" && (
                            <span
                                onClick={() => setFilter("All")}
                                style={{ marginLeft: "8px", color: "var(--info)", cursor: "pointer", fontWeight: "500" }}
                            >
                                Clear filter
                            </span>
                        )}
                    </div>

                    {/* Employee Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
                        {filtered.length === 0 && (
                            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px" }}>
                                <div style={{ color: "var(--text-muted)", marginBottom: "12px" }}><HiMagnifyingGlass size={40} /></div>
                                <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
                                    {employees.length === 0 ? "Loading employees..." : "No employees found"}
                                </p>
                            </div>
                        )}
                        {filtered.map(emp => (
                            <div
                                key={emp.id}
                                onClick={() => {
                                    setSelected(emp)
                                    API.get(`/directory/${emp.id}`).then(r => {
                                        setSelected(prev => ({ ...prev, ...r.data }))
                                    }).catch(e => {
                                        console.error("Failed to load employee profile:", e)
                                    })
                                }}
                                style={{
                                    background: "var(--bg-card)",
                                    borderRadius: "var(--radius)",
                                    padding: "20px",
                                    cursor: "pointer",
                                    boxShadow: selected?.id === emp.id ? "var(--shadow)" : "var(--shadow-sm)",
                                    border: `1px solid ${selected?.id === emp.id ? "var(--accent)" : "var(--border-light)"}`,
                                    transition: "all 0.2s ease",
                                }}
                                onMouseEnter={e => { if (selected?.id !== emp.id) { e.currentTarget.style.boxShadow = "var(--shadow)"; e.currentTarget.style.transform = "translateY(-2px)" } }}
                                onMouseLeave={e => { if (selected?.id !== emp.id) { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "translateY(0)" } }}
                            >
                                <div style={{
                                    width: "48px",
                                    height: "48px",
                                    borderRadius: "50%",
                                    background: "var(--accent)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "18px",
                                    fontWeight: "600",
                                    color: "#fff",
                                    marginBottom: "12px",
                                }}>
                                    {emp.name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ fontWeight: "600", fontSize: "15px", color: "var(--text)", marginBottom: "4px" }}>
                                    {emp.name}
                                </div>
                                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                                    {emp.department || "—"}
                                </div>
                                <div style={{
                                    display: "inline-block",
                                    padding: "4px 10px",
                                    borderRadius: "99px",
                                    background: statusBg(emp.status),
                                    color: statusColor(emp.status),
                                    fontSize: "12px",
                                    fontWeight: "500",
                                }}>
                                    {emp.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Side Panel */}
                {selected && (
                    <div style={{
                        background: "var(--bg-card)",
                        borderRadius: "var(--radius)",
                        padding: "28px",
                        boxShadow: "var(--shadow)",
                        border: "1px solid var(--border-light)",
                        height: "fit-content",
                        position: "sticky",
                        top: "40px",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                            <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text)" }}>Profile</h3>
                            <button
                                onClick={() => setSelected(null)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-muted)",
                                    cursor: "pointer",
                                    fontSize: "20px",
                                    lineHeight: 1,
                                    padding: "4px",
                                    transition: "color 0.2s",
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
                                onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{
                            width: "72px",
                            height: "72px",
                            borderRadius: "50%",
                            background: "var(--accent)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "28px",
                            fontWeight: "600",
                            color: "#fff",
                            marginBottom: "16px",
                        }}>
                            {selected.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ fontWeight: "600", fontSize: "20px", color: "var(--text)", marginBottom: "4px" }}>
                            {selected.name}
                        </div>
                        <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                            {selected.role}{selected.department ? ` · ${selected.department}` : ''}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
                                <span style={{ width: "20px", textAlign: "center" }}>✉</span>
                                {selected.email}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
                                <span style={{ width: "20px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}><HiPhone size={14} /></span>
                                {selected.phone || "—"}
                            </div>
                        </div>
                        {selected.status === "On Leave" && (
                            <div style={{
                                display: "inline-block",
                                padding: "6px 14px",
                                borderRadius: "99px",
                                background: statusBg(selected.status),
                                color: statusColor(selected.status),
                                fontSize: "13px",
                                fontWeight: "500",
                                marginBottom: "20px",
                            }}>
                                {selected.status}
                            </div>
                        )}
                        {selected.stats && (
                            <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                                {[
                                    { label: "Hours this month", value: selected.stats.hours_this_month },
                                    { label: "Tasks pending", value: selected.stats.tasks_pending },
                                    { label: "Tasks completed", value: selected.stats.tasks_completed },
                                ].map((item, i) => (
                                    <div key={i} style={{ flex: 1, textAlign: "center" }}>
                                        <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text)" }}>{item.value}</div>
                                        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{item.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {selected.attendance && selected.attendance.length > 0 && (
                            <div style={{ marginTop: "8px", marginBottom: "20px" }}>
                                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "10px" }}>Attendance — Last 7 Days</div>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    {selected.attendance.map((a, i) => {
                                        const dateObj = new Date(a.date + 'T00:00:00')
                                        const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                        return (
                                            <div key={i} style={{ padding: "10px 0", borderBottom: i < selected.attendance.length - 1 ? "1px solid var(--border-light)" : "none" }}>
                                                <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)", marginBottom: "4px" }}>{formattedDate}</div>
                                                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                                                    {fmt(a.punch_in)} → {fmt(a.punch_out)} · <span style={{ color: "var(--info)", fontWeight: "500" }}>{fmtHours(a.hours_worked)}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                        {selected.tasks && selected.tasks.length > 0 && (
                            <div style={{ marginTop: "8px", marginBottom: "20px" }}>
                                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "10px" }}>Tasks</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {selected.tasks.map(t => {
                                        const dotColor = t.status === "todo" ? "#9ca3af" : t.status === "inprogress" ? "var(--info)" : "var(--warning)"
                                        return (
                                            <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                                                    <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                                                </div>
                                                {t.due_date && <span style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: "8px" }}>{t.due_date}</span>}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => navigate(`/reports?employee_id=${selected.id}`)}
                            style={{
                                width: "100%",
                                padding: "10px",
                                borderRadius: "var(--radius-xs)",
                                border: "none",
                                background: "var(--accent)",
                                color: "#fff",
                                fontSize: "13px",
                                fontWeight: "600",
                                cursor: "pointer",
                            }}
                        >
                            Download Attendance Report
                        </button>
                    </div>
                )}
            </div>
        </Layout>
    )
}
