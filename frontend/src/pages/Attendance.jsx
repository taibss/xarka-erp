import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'
import { HiCog6Tooth } from 'react-icons/hi2'

const fmt = (dt) => dt ? new Date(dt + 'Z').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'

const SOURCE_LABELS = {
    manual: { label: 'Manual', color: '#6b7280', bg: '#f3f4f6' },
    essl: { label: 'eSSL Biometric', color: '#3b82f6', bg: '#eff6ff' },
    future_provider: { label: 'External', color: '#8b5cf6', bg: '#f5f3ff' },
}

export default function Attendance({ user }) {
    const [today, setToday] = useState(null)
    const [history, setHistory] = useState([])
    const [adminData, setAdminData] = useState([])
    const [employees, setEmployees] = useState([])
    const [selectedEmp, setSelectedEmp] = useState(null)
    const [empHistory, setEmpHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [tab, setTab] = useState('me')
    const navigate = useNavigate()

    const fetchToday = () => API.get('/attendance/today').then(r => setToday(r.data))
    const fetchHistory = () => API.get('/attendance/history').then(r => setHistory(r.data))
    const fetchAdmin = () => API.get('/attendance/admin').then(r => setAdminData(r.data))
    const fetchEmployees = () => API.get('/attendance/admin/employees').then(r => setEmployees(r.data))
    const fetchEmpHistory = (id) => API.get(`/attendance/admin/${id}`).then(r => { setEmpHistory(r.data.records); setSelectedEmp(r.data.employee) })

    useEffect(() => {
        Promise.all([fetchToday(), fetchHistory()]).finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (user?.role === 'admin') { fetchAdmin(); fetchEmployees() }
    }, [user])

    const action = async (endpoint) => {
        setBusy(true); setError('')
        try {
            await API.post(endpoint)
            await Promise.all([fetchToday(), fetchHistory()])
            if (user?.role === 'admin') fetchAdmin()
        } catch (e) {
            setError(e.response?.data?.detail || 'Something went wrong')
        } finally { setBusy(false) }
    }

    const status = today?.status
    const source = today?.source || 'manual'
    const isManual = source === 'manual'
    const handleLogout = () => { localStorage.removeItem('token'); navigate('/') }

    const card = { background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)' }

    const SourceBadge = ({ src }) => {
        const s = SOURCE_LABELS[src] || SOURCE_LABELS.manual
        return (
            <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '600' }}>
                {s.label}
            </span>
        )
    }

    const HistoryTable = ({ rows }) => (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Date', 'Punch In', 'Punch Out', 'Hours', 'Status', 'Source', 'Synced'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '500' }}>{fmtDate(row.date)}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{fmt(row.punch_in)}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{fmt(row.punch_out)}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--info)', fontWeight: '500' }}>{row.hours_worked != null ? `${row.hours_worked.toFixed(2)}h` : '--'}</td>
                        <td style={{ padding: '12px 14px' }}>
                            <span style={{
                                background: row.is_late ? 'var(--error-bg)' : 'var(--success-bg)',
                                color: row.is_late ? 'var(--error)' : 'var(--success)',
                                padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '500',
                            }}>
                                {row.is_late ? 'Late' : 'On Time'}
                            </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}><SourceBadge src={row.source} /></td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            {row.synced_at ? fmt(row.synced_at) : '--'}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: '20px 28px 28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '2px' }}>Attendance</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    {user?.role === 'admin' && (
                        <button onClick={() => navigate('/settings')} style={{
                            padding: '8px 16px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)',
                            background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                            <HiCog6Tooth size={14} /> Integration Settings
                        </button>
                    )}
                </div>

                {/* Tabs for admin */}
                {user?.role === 'admin' && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-xs)', width: 'fit-content', border: '1px solid var(--border-light)' }}>
                        {['me', 'team'].map(t => (
                            <button key={t} onClick={() => setTab(t)} style={{
                                padding: '8px 20px', borderRadius: 'var(--radius-xs)', border: 'none', cursor: 'pointer',
                                background: tab === t ? 'var(--bg-dark)' : 'transparent',
                                color: tab === t ? '#fff' : 'var(--text-secondary)', fontSize: '13px', fontWeight: '500',
                            }}>{t === 'me' ? 'My Attendance' : 'Team Attendance'}</button>
                        ))}
                    </div>
                )}

                {/* My Attendance Tab */}
                {tab === 'me' && (
                    <>
                        <div style={{ ...card, marginBottom: '20px' }}>
                            {loading ? (
                                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>Loading...</p>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    {/* Status indicator */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                        <div style={{
                                            width: '10px', height: '10px', borderRadius: '50%',
                                            background: status === 'punched_in' ? 'var(--success)' : status === 'punched_out' ? 'var(--text-muted)' : 'var(--warning)',
                                        }} />
                                        <div>
                                            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>
                                                {status === 'punched_in' ? 'In Office' : status === 'punched_out' ? 'Checked Out' : 'Not Punched In'}
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {status === 'punched_in' && `Since ${fmt(today.punch_in)}`}
                                                {status === 'punched_out' && `${fmt(today.punch_in)} - ${fmt(today.punch_out)} (${today.hours_worked?.toFixed(2)}h)`}
                                                {status === 'not_punched' && 'No record today'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Source badge */}
                                    <SourceBadge src={source} />

                                    {/* Punch button - only for manual source */}
                                    {isManual && status !== 'punched_out' && (
                                        <button
                                            onClick={() => action(status === 'punched_in' ? '/attendance/punchout' : '/attendance/punchin')}
                                            disabled={busy}
                                            style={{
                                                padding: '10px 24px', borderRadius: 'var(--radius-xs)', border: 'none',
                                                background: status === 'punched_in' ? 'var(--error)' : 'var(--success)',
                                                color: '#fff', fontSize: '13px', fontWeight: '600',
                                                cursor: busy ? 'not-allowed' : 'pointer',
                                                opacity: busy ? 0.6 : 1,
                                            }}
                                        >
                                            {busy ? '...' : status === 'punched_in' ? 'Punch Out' : 'Punch In'}
                                        </button>
                                    )}

                                    {!isManual && (
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            Managed by biometric device
                                        </span>
                                    )}

                                    {today?.is_late && (
                                        <span style={{ background: 'var(--error-bg)', color: 'var(--error)', fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: '500' }}>LATE</span>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '10px 14px', borderRadius: 'var(--radius-xs)', fontSize: '13px', marginTop: '12px' }}>
                                    {error}
                                </div>
                            )}
                        </div>

                        <div style={card}>
                            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Last 30 Days</h2>
                            {history.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px', fontSize: '13px' }}>No records yet</p>
                            ) : (
                                <HistoryTable rows={history} />
                            )}
                        </div>
                    </>
                )}

                {/* Admin Team View */}
                {tab === 'team' && user?.role === 'admin' && (
                    <>
                        <div style={{ ...card, marginBottom: '16px', padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>View Employee:</label>
                                <select
                                    value={selectedEmp?.id || ''}
                                    onChange={(e) => e.target.value ? fetchEmpHistory(e.target.value) : setSelectedEmp(null)}
                                    style={{
                                        flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-xs)',
                                        border: '1px solid var(--border)', fontSize: '13px',
                                        background: 'var(--bg)', color: 'var(--text)', outline: 'none',
                                    }}
                                >
                                    <option value="">All employees - Today's overview</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {selectedEmp ? (
                            <div style={card}>
                                <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{selectedEmp.name}'s Attendance</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>Last 30 days</p>
                                {empHistory.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px', fontSize: '13px' }}>No records found</p>
                                ) : (
                                    <HistoryTable rows={empHistory} />
                                )}
                            </div>
                        ) : (
                            <div style={card}>
                                <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Today's Overview</h2>
                                {adminData.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px', fontSize: '13px' }}>No records today</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                {['Employee', 'Punch In', 'Punch Out', 'Hours', 'Status', 'Source', 'In Office'].map(h => (
                                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {adminData.map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '12px 14px', fontWeight: '600' }}>{row.employee}</td>
                                                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{fmt(row.punch_in)}</td>
                                                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{fmt(row.punch_out)}</td>
                                                    <td style={{ padding: '12px 14px', color: 'var(--info)', fontWeight: '500' }}>{row.hours_worked != null ? `${row.hours_worked.toFixed(2)}h` : '--'}</td>
                                                    <td style={{ padding: '12px 14px' }}>
                                                        <span style={{
                                                            background: row.is_late ? 'var(--error-bg)' : 'var(--success-bg)',
                                                            color: row.is_late ? 'var(--error)' : 'var(--success)',
                                                            padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '500',
                                                        }}>
                                                            {row.is_late ? 'Late' : 'On Time'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 14px' }}><SourceBadge src={row.source} /></td>
                                                    <td style={{ padding: '12px 14px' }}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                            color: row.is_in_office ? 'var(--success)' : 'var(--text-muted)',
                                                            fontSize: '12px', fontWeight: '500',
                                                        }}>
                                                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: row.is_in_office ? 'var(--success)' : 'var(--text-muted)' }} />
                                                            {row.is_in_office ? 'In' : 'Out'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </Layout>
    )
}
