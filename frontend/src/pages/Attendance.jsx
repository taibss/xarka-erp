import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'

const fmt = (dt) => dt ? new Date(dt + 'Z').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function Attendance() {
    const [today, setToday] = useState(null)
    const [history, setHistory] = useState([])
    const [adminData, setAdminData] = useState([])
    const [employees, setEmployees] = useState([])
    const [selectedEmp, setSelectedEmp] = useState(null)
    const [empHistory, setEmpHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [user, setUser] = useState(null)
    const [tab, setTab] = useState('me')
    const navigate = useNavigate()

    const fetchToday = () => API.get('/attendance/today').then(r => setToday(r.data))
    const fetchHistory = () => API.get('/attendance/history').then(r => setHistory(r.data))
    const fetchAdmin = () => API.get('/attendance/admin').then(r => setAdminData(r.data))
    const fetchEmployees = () => API.get('/attendance/admin/employees').then(r => setEmployees(r.data))
    const fetchEmpHistory = (id) => API.get(`/attendance/admin/${id}`).then(r => { setEmpHistory(r.data.records); setSelectedEmp(r.data.employee) })

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/'); return }
        API.get('/auth/me').then(r => setUser(r.data))
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
    const handleLogout = () => { localStorage.removeItem('token'); navigate('/') }

    const card = { background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)' }

    const HistoryTable = ({ rows }) => (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Date', 'Punch In', 'Punch Out', 'Hours', 'Status'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: '500' }}>{fmtDate(row.date)}</td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{fmt(row.punch_in)}</td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{fmt(row.punch_out)}</td>
                        <td style={{ padding: '14px 16px', color: 'var(--info)', fontWeight: '500' }}>{row.hours_worked != null ? `${row.hours_worked.toFixed(2)}h` : '—'}</td>
                        <td style={{ padding: '14px 16px' }}>
                            <span style={{
                                background: row.is_late ? 'var(--error-bg)' : 'var(--success-bg)',
                                color: row.is_late ? 'var(--error)' : 'var(--success)',
                                padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '500',
                            }}>
                                {row.is_late ? 'Late' : 'On Time'}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: '40px 48px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>Attendance</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>

                {/* Tabs for admin */}
                {user?.role === 'admin' && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-card)', padding: '6px', borderRadius: 'var(--radius-sm)', width: 'fit-content', border: '1px solid var(--border-light)' }}>
                        {['me', 'team'].map(t => (
                            <button key={t} onClick={() => setTab(t)} style={{
                                padding: '10px 24px', borderRadius: 'var(--radius-xs)', border: 'none', cursor: 'pointer',
                                background: tab === t ? 'var(--bg-dark)' : 'transparent',
                                color: tab === t ? '#fff' : 'var(--text-secondary)', fontSize: '14px', fontWeight: '500',
                                transition: 'all 0.2s',
                            }}>{t === 'me' ? 'My Attendance' : 'Team Attendance'}</button>
                        ))}
                    </div>
                )}

                {/* My Attendance Tab */}
                {tab === 'me' && (
                    <>
                        <div style={{ ...card, padding: '48px', textAlign: 'center', marginBottom: '32px' }}>
                            {loading ? (
                                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
                            ) : (
                                <>
                                    {status === 'punched_in' && (
                                        <div style={{ marginBottom: '24px' }}>
                                            <div style={{
                                                width: '80px', height: '80px', borderRadius: '50%',
                                                background: 'var(--success-bg)', border: '3px solid var(--success)',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '32px', marginBottom: '16px',
                                            }}>●</div>
                                            <p style={{ color: 'var(--success)', fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                                                In since {fmt(today.punch_in)}
                                            </p>
                                            {today.is_late && (
                                                <span style={{ background: 'var(--error-bg)', color: 'var(--error)', fontSize: '12px', padding: '4px 12px', borderRadius: '99px', fontWeight: '500' }}>LATE</span>
                                            )}
                                        </div>
                                    )}

                                    {status === 'punched_out' && (
                                        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center', gap: '48px' }}>
                                            {[['IN', fmt(today.punch_in)], ['OUT', fmt(today.punch_out)], ['HOURS', `${today.hours_worked?.toFixed(2)}h`]].map(([label, val]) => (
                                                <div key={label}>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                                                    <p style={{ fontSize: '22px', fontWeight: '600', margin: 0, color: label === 'HOURS' ? 'var(--info)' : 'var(--text)' }}>{val}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {status !== 'punched_out' && (
                                        <button
                                            onClick={() => action(status === 'punched_in' ? '/attendance/punchout' : '/attendance/punchin')}
                                            disabled={busy}
                                            style={{
                                                width: '120px', height: '120px', borderRadius: '50%',
                                                border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                                                background: status === 'punched_in' ? 'var(--error)' : 'var(--success)',
                                                color: '#fff', fontSize: '16px', fontWeight: '600',
                                                opacity: busy ? 0.6 : 1,
                                                boxShadow: `0 4px 24px ${status === 'punched_in' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={e => { if (!busy) e.target.style.transform = 'scale(1.05)' }}
                                            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                        >
                                            {busy ? '...' : status === 'punched_in' ? 'Punch Out' : 'Punch In'}
                                        </button>
                                    )}

                                    {status === 'punched_out' && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
                                            <p style={{ color: 'var(--success)', fontSize: '14px', fontWeight: '500' }}>Day complete</p>
                                        </div>
                                    )}

                                    {error && (
                                        <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '12px 16px', borderRadius: 'var(--radius-xs)', fontSize: '14px', marginTop: '20px' }}>
                                            {error}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div style={card}>
                            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>Last 30 Days</h2>
                            {history.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px', fontSize: '14px' }}>No records yet</p>
                            ) : (
                                <HistoryTable rows={history} />
                            )}
                        </div>
                    </>
                )}

                {/* Admin Team View */}
                {tab === 'team' && user?.role === 'admin' && (
                    <>
                        <div style={{ ...card, marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>View Employee:</label>
                                <select
                                    value={selectedEmp?.id || ''}
                                    onChange={(e) => e.target.value && fetchEmpHistory(e.target.value)}
                                    style={{
                                        flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-xs)',
                                        border: '1px solid var(--border)', fontSize: '14px',
                                        background: 'var(--bg)', color: 'var(--text)', outline: 'none',
                                    }}
                                >
                                    <option value="">— Select an employee —</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {selectedEmp && (
                            <div style={card}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>{selectedEmp.name}'s Attendance</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>Last 30 days</p>
                                {empHistory.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px', fontSize: '14px' }}>No records found</p>
                                ) : (
                                    <HistoryTable rows={empHistory} />
                                )}
                            </div>
                        )}

                        {!selectedEmp && (
                            <div style={card}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>Today's Overview</h2>
                                {adminData.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px', fontSize: '14px' }}>No records today</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                {['Employee', 'Punch In', 'Punch Out', 'Hours', 'Status', 'In Office'].map(h => (
                                                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {adminData.map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '14px 16px', fontWeight: '600' }}>{row.employee}</td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{fmt(row.punch_in)}</td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{fmt(row.punch_out)}</td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--info)', fontWeight: '500' }}>{row.hours_worked != null ? `${row.hours_worked.toFixed(2)}h` : '—'}</td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{
                                                            background: row.is_late ? 'var(--error-bg)' : 'var(--success-bg)',
                                                            color: row.is_late ? 'var(--error)' : 'var(--success)',
                                                            padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '500',
                                                        }}>
                                                            {row.is_late ? 'Late' : 'On Time'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                            color: row.is_in_office ? 'var(--success)' : 'var(--text-muted)',
                                                            fontSize: '13px', fontWeight: '500',
                                                        }}>
                                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.is_in_office ? 'var(--success)' : 'var(--text-muted)' }} />
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
