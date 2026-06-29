import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'
import {
    HiUserGroup, HiBuildingOffice2, HiClipboardDocumentList, HiCalendarDays,
    HiArrowTrendingUp, HiClock, HiExclamationTriangle, HiCheckCircle,
    HiBell, HiMegaphone, HiVideoCamera, HiUsers
} from 'react-icons/hi2'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts'

const GREEN = '#1a3a2a'
const GREEN_LIGHT = '#2d6a4f'
const GREEN_MINT = '#52b788'
const GREEN_PALE = '#b7e4c7'
const GREEN_BG = '#d8f3dc'

const CHART_COLORS = {
    todo: '#94a3b8',
    inprogress: '#3b82f6',
    review: '#f59e0b',
    done: '#22c55e',
    pending: '#f59e0b',
    approved: '#22c55e',
    rejected: '#ef4444',
}

const card = {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
}

const cardHeader = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
}

const sectionTitle = {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text)',
    margin: 0,
}

const viewAllBtn = {
    background: 'none',
    border: 'none',
    color: GREEN_LIGHT,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    padding: 0,
}

const STATUS_COLORS = {
    approved: { bg: 'var(--success-bg)', text: 'var(--success)' },
    rejected: { bg: 'var(--error-bg)', text: 'var(--error)' },
    pending: { bg: 'var(--warning-bg)', text: 'var(--warning)' },
}

const PRIORITY_DOT = {
    high: 'var(--error)',
    medium: 'var(--warning)',
    low: 'var(--info)',
}

const STATUS_LABEL = {
    todo: 'To Do',
    inprogress: 'In Progress',
    review: 'Review',
    done: 'Done',
}

export default function AdminDashboard({ user }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        API.get('/admin/dashboard').then(r => setData(r.data)).finally(() => setLoading(false))
    }, [])

    const handleLogout = () => { localStorage.removeItem('token'); navigate('/') }

    if (loading) return <Layout user={user} onLogout={handleLogout}><p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '80px' }}>Loading...</p></Layout>
    if (!data) return <Layout user={user} onLogout={handleLogout}><p style={{ textAlign: 'center', color: 'var(--error)', marginTop: '80px' }}>Failed to load dashboard</p></Layout>

    const a = data.attendance
    const t = data.tasks
    const l = data.leaves

    const greeting = (() => {
        const h = new Date().getHours()
        if (h < 12) return 'Good morning'
        if (h < 17) return 'Good afternoon'
        return 'Good evening'
    })()

    const stats = [
        {
            label: 'Total Employees',
            value: data.total_employees,
            sub: `+${data.new_employees_month || 0} this month`,
            icon: HiUserGroup,
            color: GREEN,
        },
        {
            label: 'In Office Today',
            value: a.in_office,
            sub: `${a.attendance_rate}% attendance rate`,
            icon: HiBuildingOffice2,
            color: GREEN_LIGHT,
        },
        {
            label: 'Tasks In Progress',
            value: t.inprogress + t.review,
            sub: `${t.overdue} overdue`,
            icon: HiClipboardDocumentList,
            color: GREEN_MINT,
        },
        {
            label: 'Pending Leaves',
            value: l.pending,
            sub: 'Awaiting review',
            icon: HiCalendarDays,
            color: '#f59e0b',
        },
    ]

    const taskDonutData = [
        { name: 'To Do', value: t.todo, color: CHART_COLORS.todo },
        { name: 'In Progress', value: t.inprogress, color: CHART_COLORS.inprogress },
        { name: 'Review', value: t.review, color: CHART_COLORS.review },
        { name: 'Done', value: t.done, color: CHART_COLORS.done },
    ].filter(d => d.value > 0)

    const leaveDonutData = [
        { name: 'Pending', value: l.pending, color: CHART_COLORS.pending },
        { name: 'Approved', value: l.approved_30d, color: CHART_COLORS.approved },
        { name: 'Rejected', value: l.rejected || 0, color: CHART_COLORS.rejected },
    ].filter(d => d.value > 0)

    const formatTime = (iso) => {
        if (!iso) return ''
        const d = new Date(iso)
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    }

    const formatDate = (iso) => {
        if (!iso) return ''
        const d = new Date(iso)
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    }

    const meetingDateLabel = (iso) => {
        if (!iso) return ''
        const d = new Date(iso)
        const now = new Date()
        const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24))
        if (diff === 0) return 'Today'
        if (diff === 1) return 'Tomorrow'
        return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    }

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                    <div>
                        <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '4px' }}>
                            {greeting}, {user?.name?.split(' ')[0] || 'Admin'}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                {/* ── Row 1: Stat Cards ──────────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                    {stats.map(s => (
                        <div key={s.label} style={card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>{s.label}</p>
                                    <p style={{ fontSize: '32px', fontWeight: '700', margin: 0, lineHeight: 1 }}>{s.value}</p>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0' }}>{s.sub}</p>
                                </div>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '12px',
                                    background: s.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <s.icon size={20} color={s.color} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Row 2: Attendance Trend + Task Breakdown ───────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    {/* Attendance Trend Line Chart */}
                    <div style={card}>
                        <div style={cardHeader}>
                            <h2 style={sectionTitle}>Attendance Trend</h2>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last 30 days</span>
                        </div>
                        <div style={{ height: '240px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.attendance_trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(d) => {
                                            const date = new Date(d)
                                            return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                        }}
                                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '10px', border: '1px solid var(--border)', fontSize: '13px' }}
                                        labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                                    />
                                    <Line type="monotone" dataKey="present" stroke={GREEN} strokeWidth={2.5} dot={false} name="Present" />
                                    <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={false} name="Absent" strokeDasharray="5 5" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Task Breakdown Donut */}
                    <div style={card}>
                        <div style={cardHeader}>
                            <h2 style={sectionTitle}>Task Breakdown</h2>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.total} tasks</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '160px', height: '160px', flexShrink: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={taskDonutData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={48}
                                            outerRadius={72}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {taskDonutData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--border)', fontSize: '13px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                                {taskDonutData.map(item => (
                                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: item.color, flexShrink: 0 }} />
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>{item.name}</span>
                                        <span style={{ fontSize: '13px', fontWeight: '600' }}>{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Row 3: Productivity Leaderboard + Weekly Hours ─────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    {/* Productivity Leaderboard */}
                    <div style={card}>
                        <div style={cardHeader}>
                            <h2 style={sectionTitle}>Productivity Leaderboard</h2>
                        </div>
                        <div style={{ height: '260px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data.productivity.slice(0, 7)}
                                    layout="vertical"
                                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                                        width={100}
                                        tickFormatter={(n) => n.length > 12 ? n.slice(0, 12) + '…' : n}
                                    />
                                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--border)', fontSize: '13px' }} />
                                    <Bar dataKey="tasks_completed" fill={GREEN} radius={[0, 6, 6, 0]} barSize={20} name="Tasks Done" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Weekly Hours */}
                    <div style={card}>
                        <div style={cardHeader}>
                            <h2 style={sectionTitle}>Weekly Hours</h2>
                        </div>
                        <div style={{ height: '200px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.weekly_hours} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--border)', fontSize: '13px' }} />
                                    <Bar dataKey="hours" fill={GREEN_MINT} radius={[6, 6, 0, 0]} barSize={32} name="Avg Hours" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                            <div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Avg per day</p>
                                <p style={{ fontSize: '16px', fontWeight: '600', margin: '2px 0 0' }}>
                                    {data.weekly_hours.length > 0
                                        ? (data.weekly_hours.reduce((s, w) => s + w.hours, 0) / Math.max(data.weekly_hours.filter(w => w.hours > 0).length, 1)).toFixed(1)
                                        : 0}h
                                </p>
                            </div>
                            <div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Tasks completed</p>
                                <p style={{ fontSize: '16px', fontWeight: '600', margin: '2px 0 0' }}>{t.done}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Overdue</p>
                                <p style={{ fontSize: '16px', fontWeight: '600', margin: '2px 0 0', color: t.overdue > 0 ? 'var(--error)' : undefined }}>{t.overdue}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Row 4: Active Tasks + Leave Requests + Meetings + Team & Announcements ─ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>

                    {/* Active Tasks */}
                    <div style={card}>
                        <div style={cardHeader}>
                            <h2 style={sectionTitle}>Active Tasks</h2>
                            <button onClick={() => navigate('/tasks')} style={viewAllBtn}>Kanban →</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {data.active_tasks.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>All done!</p>
                            ) : (
                                data.active_tasks.slice(0, 6).map(task => (
                                    <div key={task.id} style={{
                                        padding: '10px 12px',
                                        background: 'var(--bg)',
                                        borderRadius: 'var(--radius-xs)',
                                        borderLeft: `3px solid ${PRIORITY_DOT[task.priority] || 'var(--border)'}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <p style={{ fontSize: '13px', fontWeight: '500', margin: 0, lineHeight: 1.3 }}>{task.title}</p>
                                            {task.is_overdue && <HiExclamationTriangle size={14} color="var(--error)" style={{ flexShrink: 0, marginTop: 2 }} />}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '2px 8px',
                                                borderRadius: '99px',
                                                background: task.status === 'inprogress' ? 'var(--info-bg)' : 'var(--warning-bg)',
                                                color: task.status === 'inprogress' ? 'var(--info)' : 'var(--warning)',
                                                fontWeight: '500',
                                            }}>
                                                {STATUS_LABEL[task.status]}
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{task.assignee}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Leave Requests */}
                    <div style={card}>
                        <div style={cardHeader}>
                            <h2 style={sectionTitle}>Leave Requests</h2>
                            <button onClick={() => navigate('/leave')} style={viewAllBtn}>View all →</button>
                        </div>
                        {leaveDonutData.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ width: '90px', height: '90px', flexShrink: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={leaveDonutData} cx="50%" cy="50%" innerRadius={28} outerRadius={40} paddingAngle={3} dataKey="value">
                                                {leaveDonutData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {leaveDonutData.map(item => (
                                        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color }} />
                                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.name}</span>
                                            <span style={{ fontSize: '12px', fontWeight: '600' }}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {l.recent.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>No requests</p>
                            ) : (
                                l.recent.map(leave => (
                                    <div key={leave.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-xs)',
                                    }}>
                                        <div>
                                            <p style={{ fontSize: '13px', fontWeight: '500', margin: 0 }}>{leave.employee}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                                                {leave.leave_type} · {leave.days}d
                                            </p>
                                        </div>
                                        <span style={{
                                            background: STATUS_COLORS[leave.status]?.bg,
                                            color: STATUS_COLORS[leave.status]?.text,
                                            padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '500',
                                        }}>{leave.status}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Upcoming Meetings */}
                    <div style={card}>
                        <div style={cardHeader}>
                            <h2 style={sectionTitle}>Upcoming Meetings</h2>
                            <button onClick={() => navigate('/meetings')} style={viewAllBtn}>View all →</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {data.upcoming_meetings.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No upcoming meetings</p>
                            ) : (
                                data.upcoming_meetings.map(m => (
                                    <div key={m.id} style={{
                                        padding: '12px',
                                        background: 'var(--bg)',
                                        borderRadius: 'var(--radius-xs)',
                                        borderLeft: `3px solid ${GREEN_MINT}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <p style={{ fontSize: '13px', fontWeight: '600', margin: 0, lineHeight: 1.3 }}>{m.title}</p>
                                            <HiVideoCamera size={14} color={GREEN_MINT} style={{ flexShrink: 0, marginTop: 2 }} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                            <HiClock size={12} color="var(--text-muted)" />
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {meetingDateLabel(m.meeting_time)} · {formatTime(m.meeting_time)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                            <HiUsers size={12} color="var(--text-muted)" />
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {m.attendee_count} attendee{m.attendee_count !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Team + Announcements */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Team */}
                        <div style={{ ...card, flex: 1 }}>
                            <div style={cardHeader}>
                                <h2 style={sectionTitle}>Team</h2>
                                <button onClick={() => navigate('/directory')} style={viewAllBtn}>Directory →</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {data.employees.slice(0, 4).map(emp => (
                                    <div key={emp.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--radius-xs)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                background: emp.is_in_office ? GREEN_BG : 'var(--bg-card)',
                                                border: `2px solid ${emp.is_in_office ? GREEN_MINT : 'var(--border)'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '10px', fontWeight: '600', color: GREEN,
                                            }}>
                                                {emp.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '12px', fontWeight: '500', margin: 0, lineHeight: 1.2 }}>{emp.name}</p>
                                                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>
                                                    {emp.department || 'General'}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: emp.is_in_office ? GREEN_MINT : 'var(--text-muted)' }} />
                                            <span style={{ fontSize: '10px', color: emp.is_in_office ? GREEN_MINT : 'var(--text-muted)' }}>
                                                {emp.is_in_office ? 'In' : 'Out'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Announcements */}
                        <div style={{ ...card, flex: 1 }}>
                            <div style={cardHeader}>
                                <h2 style={sectionTitle}>Announcements</h2>
                                <button onClick={() => navigate('/announcements')} style={viewAllBtn}>View all →</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {data.recent_announcements.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px' }}>No announcements</p>
                                ) : (
                                    data.recent_announcements.slice(0, 3).map(ann => (
                                        <div key={ann.id} style={{
                                            padding: '10px',
                                            background: 'var(--bg)',
                                            borderRadius: 'var(--radius-xs)',
                                        }}>
                                            <p style={{ fontSize: '12px', fontWeight: '600', margin: 0, lineHeight: 1.3 }}>{ann.title}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>
                                                {ann.body}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
