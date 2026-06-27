import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'
import { HiExclamationTriangle, HiCalendarDays, HiCheckCircle, HiXCircle, HiClipboardDocumentCheck, HiChatBubbleLeft, HiChartBar, HiBell } from 'react-icons/hi2'

const TYPE_ICONS = {
    overdue_task: HiExclamationTriangle,
    leave_request: HiCalendarDays,
    leave_approved: HiCheckCircle,
    leave_rejected: HiXCircle,
    task_assigned: HiClipboardDocumentCheck,
    new_comment: HiChatBubbleLeft,
    daily_digest: HiChartBar,
}

const TYPE_COLORS = {
    overdue_task: 'var(--error)',
    leave_request: 'var(--warning)',
    leave_approved: 'var(--success)',
    leave_rejected: 'var(--error)',
    task_assigned: 'var(--info)',
    new_comment: 'var(--accent)',
    daily_digest: '#8b5cf6',
}

function timeAgo(dateStr) {
    const now = new Date()
    const then = new Date(dateStr + 'Z')
    const diff = Math.floor((now - then) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return then.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function Notifications() {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState(null)
    const navigate = useNavigate()

    const fetchNotifications = async () => {
        const res = await API.get('/notifications')
        setNotifications(res.data)
    }

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/'); return }
        Promise.all([
            fetchNotifications(),
            API.get('/auth/me').then(r => setUser(r.data)),
        ]).finally(() => setLoading(false))
    }, [])

    const markRead = async (id) => {
        await API.patch(`/notifications/${id}/read`)
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    }

    const markAllRead = async () => {
        await API.patch('/notifications/read-all')
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }

    const handleLogout = () => { localStorage.removeItem('token'); navigate('/') }

    const unreadCount = notifications.filter(n => !n.is_read).length

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: '40px 48px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>Notifications</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} style={{
                            padding: '10px 20px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)',
                            background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer',
                            fontSize: '13px', fontWeight: '500', transition: 'all 0.2s',
                        }}
                            onMouseEnter={e => { e.target.style.background = 'var(--bg-dark)'; e.target.style.color = '#fff' }}
                            onMouseLeave={e => { e.target.style.background = 'var(--bg-card)'; e.target.style.color = 'var(--text-secondary)' }}
                        >
                            Mark all read
                        </button>
                    )}
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
                ) : notifications.length === 0 ? (
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '64px 32px',
                        textAlign: 'center', border: '1px solid var(--border-light)',
                    }}>
                        <div style={{ marginBottom: '16px', color: 'var(--text-muted)' }}><HiBell size={48} /></div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>No notifications yet</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>You'll see updates here when something happens</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {notifications.map(n => (
                            <div
                                key={n.id}
                                onClick={() => { markRead(n.id); if (n.link) navigate(n.link) }}
                                style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '18px 20px',
                                    border: '1px solid var(--border-light)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '16px',
                                    opacity: n.is_read ? 0.7 : 1,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
                            >
                                {/* Icon */}
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '12px',
                                    background: TYPE_COLORS[n.type] + '15',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    {TYPE_ICONS[n.type] && (() => { const Icon = TYPE_ICONS[n.type]; return <Icon size={18} color={TYPE_COLORS[n.type]} /> })()}
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                        <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', margin: 0 }}>{n.title}</p>
                                        {!n.is_read && (
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '4px' }} />
                                        )}
                                    </div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: '1.4' }}>{n.message}</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</span>
                                        {n.link && (
                                            <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '500' }}>View →</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    )
}
