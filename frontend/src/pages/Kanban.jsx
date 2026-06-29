import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'
import { HiUser, HiCalendar, HiTrash, HiCheckCircle, HiArrowPath, HiChatBubbleLeft, HiUserPlus, HiPlus, HiClock, HiExclamationTriangle, HiUserGroup, HiBolt } from 'react-icons/hi2'

const COLUMNS = [
    { id: 'todo', label: 'To Do', color: '#6b7280', bg: '#f9fafb' },
    { id: 'inprogress', label: 'In Progress', color: '#3b82f6', bg: '#eff6ff' },
    { id: 'review', label: 'Review', color: '#f59e0b', bg: '#fffbeb' },
    { id: 'done', label: 'Done', color: '#22c55e', bg: '#f0fdf4' },
]

const PRIORITY_COLORS = {
    high: { bg: '#fef2f2', text: '#ef4444', border: '#fecaca' },
    medium: { bg: '#fffbeb', text: '#f59e0b', border: '#fde68a' },
    low: { bg: '#f0fdf4', text: '#22c55e', border: '#bbf7d0' },
}

const STUCK_TASK_DAYS = 3

const ACTION_ICONS = {
    created: HiPlus,
    moved: HiArrowPath,
    completed: HiCheckCircle,
    assigned: HiUserPlus,
    commented: HiChatBubbleLeft,
}

const ACTION_COLORS = {
    created: '#3b82f6',
    moved: '#f59e0b',
    completed: '#22c55e',
    assigned: '#8b5cf6',
    commented: '#6b7280',
}

function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : null
}

function isOverdue(d) {
    return d && new Date(d) < new Date()
}

function timeAgo(dateStr) {
    if (!dateStr) return ''
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now - date
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay === 1) return 'Yesterday'
    return `${diffDay}d ago`
}

function taskAge(dateStr) {
    if (!dateStr) return ''
    const diffDays = Math.floor((new Date() - new Date(dateStr)) / 86400000)
    if (diffDays === 0) return 'Created today'
    if (diffDays === 1) return 'Created yesterday'
    return `Created ${diffDays}d ago`
}

function initials(name) {
    return name?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?'
}

function getStuckLevel(updatedAt) {
    if (!updatedAt) return null
    const days = Math.floor((new Date() - new Date(updatedAt)) / 86400000)
    if (days >= STUCK_TASK_DAYS * 2) return { level: 'stuck', label: 'Stuck', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', days }
    if (days >= STUCK_TASK_DAYS) return { level: 'at_risk', label: 'At Risk', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', days }
    return null
}

const sectionCard = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '20px', boxShadow: 'var(--shadow-sm)' }
const statCard = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '12px' }

export default function Kanban({ user }) {
    const [tasks, setTasks] = useState([])
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [draggedId, setDraggedId] = useState(null)
    const [modal, setModal] = useState(null)
    const [detailTask, setDetailTask] = useState(null)
    const [newComment, setNewComment] = useState('')
    const [newSubtask, setNewSubtask] = useState('')
    const [form, setForm] = useState({ title: '', description: '', priority: 'medium', assignee_id: '', due_date: '' })
    const [formLoading, setFormLoading] = useState(false)
    const [teamStatus, setTeamStatus] = useState([])
    const [activityFeed, setActivityFeed] = useState([])
    const navigate = useNavigate()
    const isAdmin = user?.role === 'admin'

    const fetchTasks = () => API.get('/tasks').then(r => setTasks(r.data))
    const fetchEmployees = () => API.get('/employees').then(r => setEmployees(r.data))
    const fetchTeamStatus = () => API.get('/manager/team-status').then(r => setTeamStatus(r.data))
    const fetchActivity = () => API.get('/activity/recent').then(r => setActivityFeed(r.data)).catch(() => {})

    useEffect(() => {
        Promise.all([fetchTasks(), fetchEmployees()]).finally(() => setLoading(false))
        if (user?.role === 'admin') {
            fetchTeamStatus()
            fetchActivity()
        }
    }, [user])

    useEffect(() => {
        if (detailTask) {
            const updated = tasks.find(t => t.id === detailTask.id)
            if (updated) setDetailTask(updated)
        }
    }, [tasks])

    useEffect(() => {
        if (!isAdmin) return
        const interval = setInterval(() => { fetchTeamStatus(); fetchActivity() }, 60000)
        return () => clearInterval(interval)
    }, [isAdmin])

    const stats = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10)
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
        const online = teamStatus.filter(e => e.office_status === 'In Office').length
        const activeTasks = tasks.filter(t => t.status === 'inprogress').length
        const dueToday = tasks.filter(t => t.due_date && new Date(t.due_date).toISOString().slice(0, 10) === today && t.status !== 'done').length
        const overdue = tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done').length
        const completedWeek = tasks.filter(t => t.status === 'done' && t.updated_at && t.updated_at >= weekAgo).length
        return { online, activeTasks, dueToday, overdue, completedWeek }
    }, [tasks, teamStatus])

    const stuckTasks = useMemo(() => {
        return tasks
            .filter(t => t.status !== 'done')
            .map(t => ({ ...t, stuck: getStuckLevel(t.updated_at) }))
            .filter(t => t.stuck)
            .sort((a, b) => (b.stuck?.days || 0) - (a.stuck?.days || 0))
    }, [tasks])

    const onDragStart = (e, taskId) => {
        setDraggedId(taskId)
        e.dataTransfer.effectAllowed = 'move'
    }

    const onDrop = async (e, colId) => {
        e.preventDefault()
        if (!draggedId) return
        const task = tasks.find(t => t.id === draggedId)
        if (!task || task.status === colId) { setDraggedId(null); return }
        setTasks(prev => prev.map(t => t.id === draggedId ? { ...t, status: colId } : t))
        setDraggedId(null)
        try { await API.patch(`/tasks/${draggedId}/move`, { status: colId }); fetchActivity() } catch { fetchTasks() }
    }

    const handleCreate = async () => {
        if (!form.title.trim()) return
        setFormLoading(true)
        try {
            await API.post('/tasks', {
                title: form.title, description: form.description || null,
                priority: form.priority,
                assignee_id: isAdmin ? (form.assignee_id ? parseInt(form.assignee_id) : null) : user?.id,
                due_date: form.due_date || null,
            })
            setForm({ title: '', description: '', priority: 'medium', assignee_id: '', due_date: '' })
            setModal(null)
            await fetchTasks(); fetchActivity()
        } finally { setFormLoading(false) }
    }

    const handleComment = async () => {
        if (!newComment.trim() || !detailTask) return
        await API.post(`/tasks/${detailTask.id}/comments`, { content: newComment })
        setNewComment('')
        await fetchTasks(); fetchActivity()
    }

    const handleSubtask = async () => {
        if (!newSubtask.trim() || !detailTask) return
        await API.post(`/tasks/${detailTask.id}/subtasks`, { title: newSubtask })
        setNewSubtask('')
        await fetchTasks()
    }

    const toggleSubtask = async (subtaskId) => {
        await API.patch(`/tasks/${detailTask.id}/subtasks/${subtaskId}`)
        await fetchTasks()
    }

    const handleDelete = async (taskId) => {
        if (!confirm('Delete this task?')) return
        await API.delete(`/tasks/${taskId}`)
        setDetailTask(null)
        await fetchTasks()
    }

    const handleLogout = () => { localStorage.removeItem('token'); navigate('/') }

    const inputStyle = {
        width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-xs)',
        border: '1.5px solid var(--border)', background: 'var(--bg-input)',
        color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box', outline: 'none',
    }

    const labelStyle = { display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px', fontWeight: '500' }

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: '20px 28px 28px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '2px' }}>
                            Tasks{isAdmin ? ' -- All Team' : ''}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {isAdmin ? 'All team tasks -- drag to update status' : 'Your assigned tasks -- drag to update status'}
                        </p>
                    </div>
                    <button onClick={() => setModal('create')} style={{
                        padding: '10px 20px', borderRadius: 'var(--radius-xs)', border: 'none',
                        background: 'var(--bg-dark)', color: '#fff', fontSize: '13px', fontWeight: '600',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                        <HiPlus size={16} /> New Task
                    </button>
                </div>

                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '60px' }}>Loading...</p>
                ) : (
                    <>
                        {/* ── Stats Row ── */}
                        {isAdmin && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
                                {[
                                    { label: 'Employees Online', value: stats.online, icon: <HiUserGroup size={18} />, color: '#22c55e' },
                                    { label: 'Active Tasks', value: stats.activeTasks, icon: <HiBolt size={18} />, color: '#3b82f6' },
                                    { label: 'Due Today', value: stats.dueToday, icon: <HiClock size={18} />, color: '#f59e0b' },
                                    { label: 'Overdue Tasks', value: stats.overdue, icon: <HiExclamationTriangle size={18} />, color: '#ef4444' },
                                    { label: 'Completed Week', value: stats.completedWeek, icon: <HiCheckCircle size={18} />, color: '#22c55e' },
                                ].map(s => (
                                    <div key={s.label} style={statCard}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: 'var(--radius-xs)',
                                            background: s.color + '12', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', color: s.color, flexShrink: 0,
                                        }}>
                                            {s.icon}
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text)', lineHeight: '1.2' }}>{s.value}</p>
                                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>{s.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Main: Kanban + Sidebar ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 280px' : '1fr', gap: '20px' }}>
                            {/* Kanban Board */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', alignContent: 'start' }}>
                                {COLUMNS.map(col => {
                                    const colTasks = tasks.filter(t => t.status === col.id)
                                    return (
                                        <div
                                            key={col.id}
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={e => onDrop(e, col.id)}
                                            style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border-light)', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', padding: '0 2px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                                                    <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text)' }}>{col.label}</span>
                                                </div>
                                                <span style={{ background: col.bg, color: col.color, fontSize: '11px', padding: '2px 8px', borderRadius: '99px', fontWeight: '600' }}>{colTasks.length}</span>
                                            </div>

                                            {colTasks.map(task => {
                                                const pc = PRIORITY_COLORS[task.priority]
                                                const overdue = isOverdue(task.due_date) && task.status !== 'done'
                                                return (
                                                    <div
                                                        key={task.id}
                                                        draggable
                                                        onDragStart={e => onDragStart(e, task.id)}
                                                        onClick={() => setDetailTask(task)}
                                                        style={{
                                                            background: 'var(--bg-card)',
                                                            border: `1px solid ${overdue ? '#fecaca' : 'var(--border)'}`,
                                                            borderLeft: overdue ? '3px solid #ef4444' : '3px solid transparent',
                                                            borderRadius: 'var(--radius-xs)', padding: '14px',
                                                            cursor: 'grab', transition: 'all 0.15s',
                                                            opacity: draggedId === task.id ? 0.4 : 1,
                                                            boxShadow: 'var(--shadow-sm)',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                                        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)' }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                            <span style={{ background: pc.bg, color: pc.text, fontSize: '10px', padding: '2px 8px', borderRadius: '99px', textTransform: 'uppercase', fontWeight: '600', border: `1px solid ${pc.border}` }}>
                                                                {task.priority}
                                                            </span>
                                                            {task.subtasks?.length > 0 && (
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '500' }}>
                                                                    {task.subtasks.filter(s => s.is_done).length}/{task.subtasks.length}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '500', lineHeight: '1.4', color: 'var(--text)' }}>{task.title}</p>
                                                        <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--text-muted)' }}>{taskAge(task.created_at)}</p>

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            {task.assignee ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <div style={{
                                                                        width: '20px', height: '20px', borderRadius: '50%',
                                                                        background: 'var(--bg-dark)', color: '#fff',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        fontSize: '9px', fontWeight: '600', flexShrink: 0,
                                                                    }}>
                                                                        {initials(task.assignee.name)}
                                                                    </div>
                                                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                                                                        {task.assignee.name.split(' ')[0]}
                                                                    </span>
                                                                </div>
                                                            ) : <span />}
                                                            {task.due_date && (
                                                                <span style={{ fontSize: '11px', color: overdue ? 'var(--error)' : 'var(--text-muted)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                    {overdue && <HiExclamationTriangle size={11} />}{fmtDate(task.due_date)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {task.comments?.length > 0 && (
                                                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                <HiChatBubbleLeft size={11} /> {task.comments.length}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}

                                            {colTasks.length === 0 && (
                                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px 0', fontStyle: 'italic' }}>Drop here</div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* ── Right Sidebar: Activity + Stuck Tasks ── */}
                            {isAdmin && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Recent Activity */}
                                    <div style={{ ...sectionCard, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                        <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recent Activity</h3>
                                        {activityFeed.length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>No recent activity</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
                                                {activityFeed.map(item => {
                                                    const Icon = ACTION_ICONS[item.action] || HiArrowPath
                                                    const color = ACTION_COLORS[item.action] || '#6b7280'
                                                    return (
                                                        <div key={item.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                            <div style={{
                                                                width: '22px', height: '22px', borderRadius: '50%',
                                                                background: color + '12', display: 'flex', alignItems: 'center',
                                                                justifyContent: 'center', flexShrink: 0,
                                                            }}>
                                                                <Icon size={11} color={color} />
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text)', lineHeight: '1.4' }}>
                                                                    <strong>{item.employee_name}</strong> {item.detail}
                                                                </p>
                                                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{timeAgo(item.created_at)}</p>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Stuck Tasks */}
                                    {stuckTasks.length > 0 && (
                                        <div style={{ ...sectionCard }}>
                                            <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '10px', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stuck Tasks</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {stuckTasks.slice(0, 5).map(task => (
                                                    <div key={task.id} style={{
                                                        padding: '8px 10px', borderRadius: 'var(--radius-xs)',
                                                        background: task.stuck.bg, border: `1px solid ${task.stuck.border}`,
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    }}>
                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                            <p style={{ margin: 0, fontSize: '12px', fontWeight: '500', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                                                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{task.assignee?.name || 'Unassigned'}</p>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                                                            <span style={{ fontSize: '11px', fontWeight: '600', color: task.stuck.color }}>{task.stuck.days}d</span>
                                                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '99px', background: task.stuck.color + '18', color: task.stuck.color, fontWeight: '600' }}>{task.stuck.label}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Team Workload */}
                                    {teamStatus.length > 0 && (
                                        <div style={{ ...sectionCard }}>
                                            <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '10px', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Team Workload</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                                {teamStatus.map(emp => {
                                                    const isOnline = emp.office_status === 'In Office'
                                                    const statusColor = isOnline ? '#22c55e' : '#b5b0aa'
                                                    return (
                                                        <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
                                                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                <p style={{ margin: 0, fontSize: '12px', fontWeight: '500', color: 'var(--text)' }}>{emp.name}</p>
                                                                <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {emp.current_task ? emp.current_task.title : 'No Active Task'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Create Task Modal */}
            {modal === 'create' && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(4px)' }} onClick={() => setModal(null)}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '28px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '700' }}>New Task</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={labelStyle}>Title *</label>
                                <input style={inputStyle} placeholder="What needs to be done?" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                            </div>
                            <div>
                                <label style={labelStyle}>Description</label>
                                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }} placeholder="Details..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Priority</label>
                                    <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Due Date</label>
                                    <input type="date" style={inputStyle} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                                </div>
                            </div>
                            {isAdmin && (
                                <div>
                                    <label style={labelStyle}>Assign To</label>
                                    <select style={inputStyle} value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}>
                                        <option value="">Unassigned</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.department ? ` (${e.department})` : ''}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setModal(null)} style={{ padding: '9px 18px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Cancel</button>
                            <button onClick={handleCreate} disabled={formLoading || !form.title.trim()} style={{ padding: '9px 18px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--bg-dark)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', opacity: formLoading || !form.title.trim() ? 0.5 : 1 }}>
                                {formLoading ? 'Creating...' : 'Create Task'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Detail Modal */}
            {detailTask && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(4px)' }} onClick={() => setDetailTask(null)}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div style={{ flex: 1, paddingRight: '12px' }}>
                                <span style={{
                                    background: PRIORITY_COLORS[detailTask.priority].bg,
                                    color: PRIORITY_COLORS[detailTask.priority].text,
                                    border: `1px solid ${PRIORITY_COLORS[detailTask.priority].border}`,
                                    fontSize: '10px', padding: '2px 8px', borderRadius: '99px',
                                    textTransform: 'uppercase', fontWeight: '600', display: 'inline-block', marginBottom: '8px'
                                }}>
                                    {detailTask.priority}
                                </span>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>{detailTask.title}</h2>
                            </div>
                            <button onClick={() => handleDelete(detailTask.id)} style={{ background: 'var(--error-bg)', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center' }}><HiTrash size={14} /></button>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiUser size={13} /> {detailTask.assignee?.name || 'Unassigned'}</span>
                            {detailTask.due_date && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCalendar size={13} /> {fmtDate(detailTask.due_date)}</span>}
                            <span>by {detailTask.created_by?.name}</span>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ ...labelStyle, marginBottom: '8px' }}>Move to</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {COLUMNS.map(col => (
                                    <button key={col.id} onClick={async () => { await API.patch(`/tasks/${detailTask.id}/move`, { status: col.id }); await fetchTasks(); fetchActivity() }}
                                        style={{
                                            padding: '7px 12px', borderRadius: 'var(--radius-xs)', border: '1.5px solid',
                                            borderColor: detailTask.status === col.id ? col.color : 'var(--border)',
                                            background: detailTask.status === col.id ? col.color + '15' : 'var(--bg)',
                                            color: detailTask.status === col.id ? col.color : 'var(--text-secondary)',
                                            cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                                        }}>
                                        {col.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {detailTask.description && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6', padding: '14px', background: 'var(--bg)', borderRadius: 'var(--radius-xs)' }}>{detailTask.description}</p>
                        )}

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ ...labelStyle, marginBottom: '10px', fontWeight: '600' }}>Subtasks</label>
                            {detailTask.subtasks?.map(st => (
                                <div key={st.id} onClick={() => toggleSubtask(st.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}>
                                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1.5px solid', borderColor: st.is_done ? 'var(--success)' : 'var(--border)', background: st.is_done ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {st.is_done && <span style={{ color: '#fff', fontSize: '10px' }}>v</span>}
                                    </div>
                                    <span style={{ fontSize: '13px', color: st.is_done ? 'var(--text-muted)' : 'var(--text)', textDecoration: st.is_done ? 'line-through' : 'none' }}>{st.title}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <input style={{ ...inputStyle, flex: 1 }} placeholder="Add subtask..." value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubtask()} />
                                <button onClick={handleSubtask} style={{ padding: '8px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Add</button>
                            </div>
                        </div>

                        <div>
                            <label style={{ ...labelStyle, marginBottom: '10px', fontWeight: '600' }}>Comments</label>
                            {detailTask.comments?.map(c => (
                                <div key={c.id} style={{ padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-xs)', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--info)' }}>{c.author}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: '1.5' }}>{c.content}</p>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <input style={{ ...inputStyle, flex: 1 }} placeholder="Write a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleComment()} />
                                <button onClick={handleComment} style={{ padding: '8px 18px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--bg-dark)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Send</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
