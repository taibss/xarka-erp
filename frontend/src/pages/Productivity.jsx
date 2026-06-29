import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'

const PRIORITY_COLORS = {
    high: { bg: '#fef2f2', text: '#ef4444', border: '#fecaca' },
    medium: { bg: '#fffbeb', text: '#f59e0b', border: '#fde68a' },
    low: { bg: '#f0fdf4', text: '#22c55e', border: '#bbf7d0' },
}

const RANK_COLORS = ['#f59e0b', '#9ca3af', '#b45309']

export default function Productivity() {
    const [stats, setStats] = useState(null)
    const [leaderboard, setLeaderboard] = useState([])
    const [myTasks, setMyTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState('me')
    const navigate = useNavigate()

    const fetchStats = async () => {
        const res = await API.get('/productivity/me')
        setStats(res.data)
        setMyTasks(res.data.completed_tasks || [])
    }

    const fetchLeaderboard = async () => {
        const res = await API.get('/productivity/leaderboard')
        setLeaderboard(res.data)
    }

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/'); return }
        Promise.all([fetchStats(), fetchLeaderboard()]).finally(() => setLoading(false))
    }, [])

    const handleLogout = () => { localStorage.removeItem('token'); navigate('/') }

    const card = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow-sm)' }

    return (
        <Layout user={null} onLogout={handleLogout}>
            <div style={{ padding: '40px 48px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>Productivity</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Track your performance and output</p>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '32px', background: 'var(--bg-card)', padding: '6px', borderRadius: 'var(--radius-sm)', width: 'fit-content', border: '1px solid var(--border-light)' }}>
                    {[['me', 'My Stats'], ['leaderboard', 'Leaderboard']].map(([id, label]) => (
                        <button key={id} onClick={() => setTab(id)} style={{
                            padding: '10px 24px', borderRadius: 'var(--radius-xs)', border: 'none', cursor: 'pointer',
                            background: tab === id ? 'var(--bg-dark)' : 'transparent',
                            color: tab === id ? '#fff' : 'var(--text-secondary)', fontSize: '14px', fontWeight: '500',
                            transition: 'all 0.2s',
                        }}>{label}</button>
                    ))}
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
                ) : tab === 'me' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Stat cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                            {[
                                { label: 'Tasks Done', value: stats?.tasks_completed, color: 'var(--success)' },
                                { label: 'Rank', value: `#${leaderboard.find(e => e.employee_id === stats?.employee_id)?.rank || '—'}`, color: 'var(--accent)' },
                            ].map((s) => (
                                <div key={s.label} style={{ ...card, textAlign: 'center' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>{s.label}</p>
                                    <p style={{ fontSize: '36px', fontWeight: '700', margin: 0, color: s.color }}>{s.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Completed tasks */}
                        <div style={card}>
                            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 20px', color: 'var(--text)' }}>Completed Tasks</h2>
                            {myTasks.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>No completed tasks yet</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {myTasks.map(task => {
                                        const pc = PRIORITY_COLORS[task.priority]
                                        return (
                                            <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-xs)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#fff', fontWeight: '600' }}>✓</div>
                                                    <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>{task.title}</span>
                                                </div>
                                                <span style={{ background: pc.bg, color: pc.text, fontSize: '11px', padding: '3px 10px', borderRadius: '99px', textTransform: 'uppercase', fontWeight: '600', border: `1px solid ${pc.border}` }}>
                                                    {task.priority}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={card}>
                        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 24px', color: 'var(--text)' }}>Leaderboard</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {leaderboard.map((entry, i) => (
                                <div key={entry.employee_id} style={{
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    padding: '18px 20px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                                    border: i < 3 ? `1.5px solid ${RANK_COLORS[i]}33` : '1px solid var(--border-light)',
                                }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        background: i < 3 ? RANK_COLORS[i] + '18' : 'var(--bg-card)',
                                        color: i < 3 ? RANK_COLORS[i] : 'var(--text-muted)',
                                        fontSize: '14px', fontWeight: '700', border: `1.5px solid ${i < 3 ? RANK_COLORS[i] + '33' : 'var(--border)'}`,
                                    }}>
                                        {i + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{entry.name}</p>
                                        {entry.department && <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{entry.department}</p>}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--success)' }}>{entry.tasks_completed}</p>
                                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>tasks done</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
