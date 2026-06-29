import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import API from "../api"
import Layout from "../components/Layout"
import { HiEnvelope, HiPhone, HiCalendar } from "react-icons/hi2"

export default function Profile({ user }) {
    const [profile, setProfile] = useState(null)
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({})
    const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" })
    const [message, setMessage] = useState("")
    const navigate = useNavigate()

    useEffect(() => {
        API.get("/profile/me").then(r => {
            setProfile(r.data)
            setForm({ name: r.data.name, phone: r.data.phone || "" })
        })
    }, [])

    const handleLogout = () => {
        localStorage.removeItem("token")
        navigate("/")
    }

    const handleSave = async () => {
        await API.put("/profile/me", form)
        setMessage("Profile updated!")
        setEditing(false)
        API.get("/profile/me").then(r => setProfile(r.data))
    }

    const handlePassword = async () => {
        try {
            await API.put("/profile/password", passwordForm)
            setMessage("Password updated!")
            setPasswordForm({ current_password: "", new_password: "" })
        } catch {
            setMessage("Wrong current password!")
        }
    }

    if (!profile) return <Layout user={user} onLogout={handleLogout}><div style={{ padding: "40px 48px" }}>Loading...</div></Layout>

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: "40px 48px", maxWidth: "720px" }}>
                {/* Header */}
                <div style={{ marginBottom: "32px" }}>
                    <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text)", marginBottom: "4px" }}>
                        My Profile
                    </h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
                        Manage your personal information
                    </p>
                </div>

                {/* Success / Error message */}
                {message && (
                    <div style={{
                        background: message.includes("Wrong") ? "var(--error-bg)" : "var(--success-bg)",
                        border: `1px solid ${message.includes("Wrong") ? "var(--error)" : "var(--success)"}`,
                        borderRadius: "var(--radius-sm)",
                        padding: "12px 16px",
                        marginBottom: "20px",
                        color: message.includes("Wrong") ? "var(--error)" : "var(--success)",
                        fontSize: "14px",
                        fontWeight: "500",
                    }}>
                        {message}
                    </div>
                )}

                {/* Profile Card */}
                <div style={{
                    background: "var(--bg-card)",
                    borderRadius: "var(--radius)",
                    padding: "28px",
                    boxShadow: "var(--shadow-sm)",
                    border: "1px solid var(--border-light)",
                    marginBottom: "20px",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "24px" }}>
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
                            flexShrink: 0,
                        }}>
                            {profile.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "600", fontSize: "20px", color: "var(--text)", marginBottom: "4px" }}>{profile.name}</div>
                            <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{profile.role} · {profile.department}</div>
                        </div>
                        <button
                            onClick={() => setEditing(!editing)}
                            style={{
                                padding: "8px 18px",
                                borderRadius: "var(--radius-xs)",
                                border: "1px solid var(--border)",
                                background: "var(--bg-card)",
                                color: "var(--text)",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: "500",
                                transition: "all 0.2s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-input)"; e.currentTarget.style.borderColor = "var(--text-muted)" }}
                            onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border)" }}
                        >
                            {editing ? "Cancel" : "Edit"}
                        </button>
                    </div>

                    {editing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="Name"
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: "var(--radius-xs)",
                                    border: "1px solid var(--border)",
                                    background: "var(--bg-input)",
                                    color: "var(--text)",
                                    fontSize: "14px",
                                    outline: "none",
                                    transition: "border 0.2s",
                                }}
                                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                                onBlur={e => e.target.style.borderColor = "var(--border)"}
                            />
                            <input
                                value={form.phone}
                                onChange={e => setForm({ ...form, phone: e.target.value })}
                                placeholder="Phone"
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: "var(--radius-xs)",
                                    border: "1px solid var(--border)",
                                    background: "var(--bg-input)",
                                    color: "var(--text)",
                                    fontSize: "14px",
                                    outline: "none",
                                    transition: "border 0.2s",
                                }}
                                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                                onBlur={e => e.target.style.borderColor = "var(--border)"}
                            />
                            <button
                                onClick={handleSave}
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
                                Save Changes
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
                                <span style={{ width: "20px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}><HiEnvelope size={14} /></span>
                                {profile.email}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
                                <span style={{ width: "20px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}><HiPhone size={14} /></span>
                                {profile.phone || "—"}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
                                <span style={{ width: "20px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}><HiCalendar size={14} /></span>
                                Joined: {profile.joining_date || "—"}
                            </div>
                        </div>
                    )}
                </div>

                {/* Change Password Card */}
                <div style={{
                    background: "var(--bg-card)",
                    borderRadius: "var(--radius)",
                    padding: "28px",
                    boxShadow: "var(--shadow-sm)",
                    border: "1px solid var(--border-light)",
                }}>
                    <h3 style={{ marginBottom: "20px", fontSize: "17px", fontWeight: "600", color: "var(--text)" }}>Change Password</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <input
                            type="password"
                            placeholder="Current password"
                            value={passwordForm.current_password}
                            onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                            style={{
                                padding: "10px 14px",
                                borderRadius: "var(--radius-xs)",
                                border: "1px solid var(--border)",
                                background: "var(--bg-input)",
                                color: "var(--text)",
                                fontSize: "14px",
                                outline: "none",
                                transition: "border 0.2s",
                            }}
                            onFocus={e => e.target.style.borderColor = "var(--accent)"}
                            onBlur={e => e.target.style.borderColor = "var(--border)"}
                        />
                        <input
                            type="password"
                            placeholder="New password"
                            value={passwordForm.new_password}
                            onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                            style={{
                                padding: "10px 14px",
                                borderRadius: "var(--radius-xs)",
                                border: "1px solid var(--border)",
                                background: "var(--bg-input)",
                                color: "var(--text)",
                                fontSize: "14px",
                                outline: "none",
                                transition: "border 0.2s",
                            }}
                            onFocus={e => e.target.style.borderColor = "var(--accent)"}
                            onBlur={e => e.target.style.borderColor = "var(--border)"}
                        />
                        <button
                            onClick={handlePassword}
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
                            Update Password
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
