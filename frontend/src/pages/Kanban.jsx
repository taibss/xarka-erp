import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'
import { HiUser, HiCalendar, HiExclamationTriangle, HiTrash } from 'react-icons/hi2'

const COLUMNS = [
    { id: 'todo', label: 'To Do', color: '#6b7280' },
    { id: 'inprogress', label: 'In Progress', color: '#3b82f6' },
    { id: 'review', label: 'Review', color: '#f59e0b' },
    { id: 'done', label: 'Done', color: '#22c55e' },
]

const PRIORITY_COLORS = {
    high: { bg: '#fef2f2', text: '#ef4444', border: '#fecaca' },
    medium: { bg: '#fffbeb', text: '#f59e0b', border: '#fde68a' },
    low: { bg: '#f0fdf4', text: '#22c55e', border: '#bbf7d0' },
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : null
const isOverdue = (d) => d && new Date(d) < new Date()

export default function Kanban() {
    const [tasks, setTasks] = useState([])
    const [employees, setEmployees] = useState([])
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [draggedId, setDraggedId] = useState(null)
    const [modal, setModal] = useState(null)
    const [detailTask, setDetailTask] = useState(null)
    const [newComment, setNewComment] = useState('')
    const [newSubtask, setNewSubtask] = useState('')
    const [form, setForm] = useState({ title: '', description: '', priority: 'medium', assignee_id: '', due_date: '' })
    const [formLoading, setFormLoading] = useState(false)
    const navigate = useNavigate()
    const isAdmin = user?.role === 'admin'

    const fetchTasks = () => API.get('/tasks').then(r => setTasks(r.data))
    const fetchEmployees = () => API.get('/employees').then(r => setEmployees(r.data))

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/'); return }
        API.get('/auth/me').then(r => setUser(r.data))
        Promise.all([fetchTasks(), fetchEmployees()]).finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (detailTask) {
            const updated = tasks.find(t => t.id === detailTask.id)
            if (updated) setDetailTask(updated)
        }
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
        try { await API.patch(`/tasks/${draggedId}/move`, { status: colId }) } catch { fetchTasks() }
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
            await fetchTasks()
        } finally { setFormLoading(false) }
    }

    const handleComment = async () => {
        if (!newComment.trim() || !detailTask) return
        await API.post(`/tasks/${detailTask.id}/comments`, { content: newComment })
        setNewComment('')
        await fetchTasks()
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
        transition: 'border-color 0.2s',
    }

    const labelStyle = { display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px', fontWeight: '500' }

    return (
        <Layout user={user} onLogout={handleLogout}>
            {/* Header */}
            <div style={{ padding: '24px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>Tasks</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                        {isAdmin ? 'All team tasks' : 'Your assigned tasks'} — drag to update status
                    </p>
                </div>
                <button onClick={() => setModal('create')} style={{
                    padding: '12px 24px', borderRadius: 'var(--radius-sm)', border: 'none',
                    background: 'var(--bg-dark)', color: '#fff', fontSize: '14px', fontWeight: '600',
                    cursor: 'pointer', transition: 'opacity 0.2s',
                }} onMouseEnter={e => e.target.style.opacity = '0.85'} onMouseLeave={e => e.target.style.opacity = '1'}>
                    + New Task
                </button>
            </div>

            {/* Board */}
            {loading ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '80px' }}>Loading...</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '24px 32px', height: 'calc(100vh - 120px)', boxSizing: 'border-box' }}>
                    {COLUMNS.map(col => {
                        const colTasks = tasks.filter(t => t.status === col.id)
                        return (
                            <div
                                key={col.id}
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => onDrop(e, col.id)}
                                style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', border: '1px solid var(--border-light)' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                                        <span style={{ fontWeight: '600', fontSize: '14px' }}>{col.label}</span>
                                    </div>
                                    <span style={{ background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '12px', padding: '2px 10px', borderRadius: '99px', fontWeight: '500' }}>{colTasks.length}</span>
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
                                                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                                padding: '16px', cursor: 'grab', transition: 'all 0.15s',
                                                opacity: draggedId === task.id ? 0.4 : 1,
                                                boxShadow: 'var(--shadow-sm)',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)' }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                <span style={{ background: pc.bg, color: pc.text, fontSize: '11px', padding: '3px 10px', borderRadius: '99px', textTransform: 'uppercase', fontWeight: '600', border: `1px solid ${pc.border}` }}>
                                                    {task.priority}
                                                </span>
                                                {task.subtasks?.length > 0 && (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '500' }}>
                                                        {task.subtasks.filter(s => s.is_done).length}/{task.subtasks.length} ✓
                                                    </span>
                                                )}
                                            </div>

                                            <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '500', lineHeight: '1.4', color: 'var(--text)' }}>{task.title}</p>

                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation()
                                                    try {
                                                        await API.post(`/productivity/timer/start/${task.id}`)
                                                        alert(`Timer started: ${task.title}`)
                                                    } catch (err) {
                                                        alert(err.response?.data?.detail || 'Could not start timer')
                                                    }
                                                }}
                                                style={{
                                                    marginBottom: '10px', padding: '5px 12px', fontSize: '12px',
                                                    borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)',
                                                    background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer',
                                                    fontWeight: '500', transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={e => { e.target.style.background = 'var(--bg-dark)'; e.target.style.color = '#fff' }}
                                                onMouseLeave={e => { e.target.style.background = 'var(--bg)'; e.target.style.color = 'var(--text-secondary)' }}
                                            >
                                                ▶ Track
                                            </button>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                {task.assignee ? (
                                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <HiUser size={12} /> {task.assignee.name.split(' ')[0]}
                                                    </span>
                                                ) : <span />}
                                                {task.due_date && (
                                                    <span style={{ fontSize: '12px', color: overdue ? 'var(--error)' : 'var(--text-muted)', fontWeight: '500' }}>
                                                        {overdue ? '⚠ ' : ''}{fmtDate(task.due_date)}
                                                    </span>
                                                )}
                                            </div>
                                            {task.comments?.length > 0 && (
                                                <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    💬 {task.comments.length} comment{task.comments.length > 1 ? 's' : ''}
                                                </p>
                                            )}
                                        </div>
                                    )
                                })}

                                {colTasks.length === 0 && (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', paddingTop: '24px', fontStyle: 'italic' }}>Drop here</div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create Task Modal */}
            {modal === 'create' && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(4px)' }} onClick={() => setModal(null)}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 24px', fontSize: '20px', fontWeight: '700' }}>New Task</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Title *</label>
                                <input style={inputStyle} placeholder="What needs to be done?" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                            </div>
                            <div>
                                <label style={labelStyle}>Description</label>
                                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} placeholder="Details..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
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
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                            <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Cancel</button>
                            <button onClick={handleCreate} disabled={formLoading || !form.title.trim()} style={{ padding: '10px 20px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--bg-dark)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', opacity: formLoading || !form.title.trim() ? 0.5 : 1 }}>
                                {formLoading ? 'Creating...' : 'Create Task'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Detail Modal */}
            {detailTask && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(4px)' }} onClick={() => setDetailTask(null)}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <div style={{ flex: 1, paddingRight: '16px' }}>
                                <span style={{
                                    background: PRIORITY_COLORS[detailTask.priority].bg,
                                    color: PRIORITY_COLORS[detailTask.priority].text,
                                    border: `1px solid ${PRIORITY_COLORS[detailTask.priority].border}`,
                                    fontSize: '11px', padding: '3px 10px', borderRadius: '99px',
                                    textTransform: 'uppercase', fontWeight: '600', display: 'inline-block', marginBottom: '10px'
                                }}>
                                    {detailTask.priority}
                                </span>
                                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>{detailTask.title}</h2>
                            </div>
                            <button onClick={() => handleDelete(detailTask.id)} style={{ background: 'var(--error-bg)', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '8px', borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center' }}><HiTrash size={16} /></button>
                        </div>

                        <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiUser size={14} /> {detailTask.assignee?.name || 'Unassigned'}</span>
                            {detailTask.due_date && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCalendar size={14} /> {fmtDate(detailTask.due_date)}</span>}
                            <span>by {detailTask.created_by?.name}</span>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ ...labelStyle, marginBottom: '10px' }}>Move to</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {COLUMNS.map(col => (
                                    <button key={col.id} onClick={async () => { await API.patch(`/tasks/${detailTask.id}/move`, { status: col.id }); await fetchTasks() }}
                                        style={{
                                            padding: '8px 14px', borderRadius: 'var(--radius-xs)', border: '1.5px solid',
                                            borderColor: detailTask.status === col.id ? col.color : 'var(--border)',
                                            background: detailTask.status === col.id ? col.color + '15' : 'var(--bg)',
                                            color: detailTask.status === col.id ? col.color : 'var(--text-secondary)',
                                            cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'all 0.15s',
                                        }}>
                                        {col.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {detailTask.description && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-xs)' }}>{detailTask.description}</p>
                        )}

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ ...labelStyle, marginBottom: '12px', fontWeight: '600' }}>Subtasks</label>
                            {detailTask.subtasks?.map(st => (
                                <div key={st.id} onClick={() => toggleSubtask(st.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: '6px', border: '1.5px solid', borderColor: st.is_done ? 'var(--success)' : 'var(--border)', background: st.is_done ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {st.is_done && <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>}
                                    </div>
                                    <span style={{ fontSize: '14px', color: st.is_done ? 'var(--text-muted)' : 'var(--text)', textDecoration: st.is_done ? 'line-through' : 'none' }}>{st.title}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                <input style={{ ...inputStyle, flex: 1 }} placeholder="Add subtask..." value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubtask()} />
                                <button onClick={handleSubtask} style={{ padding: '10px 16px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Add</button>
                            </div>
                        </div>

                        <div>
                            <label style={{ ...labelStyle, marginBottom: '12px', fontWeight: '600' }}>Comments</label>
                            {detailTask.comments?.map(c => (
                                <div key={c.id} style={{ padding: '14px', background: 'var(--bg)', borderRadius: 'var(--radius-xs)', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--info)' }}>{c.author}</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)', lineHeight: '1.5' }}>{c.content}</p>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                <input style={{ ...inputStyle, flex: 1 }} placeholder="Write a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleComment()} />
                                <button onClick={handleComment} style={{ padding: '10px 20px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--bg-dark)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Send</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
