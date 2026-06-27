import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'

const STATUS_COLORS = {
    pending: { bg: '#fffbeb', text: '#f59e0b', border: '#fde68a' },
    approved: { bg: '#f0fdf4', text: '#22c55e', border: '#bbf7d0' },
    rejected: { bg: '#fef2f2', text: '#ef4444', border: '#fecaca' },
}

const TYPE_COLORS = {
    sick: { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe' },
    casual: { bg: '#faf5ff', text: '#8b5cf6', border: '#ddd6fe' },
    annual: { bg: '#f0fdf4', text: '#22c55e', border: '#bbf7d0' },
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function Leave() {
    const [balance, setBalance] = useState(null)
    const [leaves, setLeaves] = useState([])
    const [adminLeaves, setAdminLeaves] = useState([])
    const [user, setUser] = useState(null)
    const [tab, setTab] = useState('my')
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ leave_type: 'casual', from_date: '', to_date: '', reason: '' })
    const [formLoading, setFormLoading] = useState(false)
    const [formError, setFormError] = useState('')
    const [rejectModal, setRejectModal] = useState(null)
    const [rejectReason, setRejectReason] = useState('')
    const navigate = useNavigate()

    const fetchAll = async () => {
        const [meRes, balRes, leavesRes] = await Promise.all([
            API.get('/auth/me'), API.get('/leave/balance'), API.get('/leave/my'),
        ])
        setUser(meRes.data)
        setBalance(balRes.data)
        setLeaves(leavesRes.data)
        if (meRes.data.role === 'admin') {
            const adminRes = await API.get('/leave/admin')
            setAdminLeaves(adminRes.data)
        }
    }

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/'); return }
        fetchAll()
    }, [])

    const handleApply = async () => {
        if (!form.from_date || !form.to_date) { setFormError('Please select dates'); return }
        setFormLoading(true); setFormError('')
        try {
            await API.post('/leave/apply', form)
            setShowForm(false)
            setForm({ leave_type: 'casual', from_date: '', to_date: '', reason: '' })
            await fetchAll()
        } catch (e) { setFormError(e.response?.data?.detail || 'Failed to apply') }
        finally { setFormLoading(false) }
    }

    const handleReview = async (leaveId, status) => {
        try {
            await API.patch(`/leave/${leaveId}/review`, { status, rejection_reason: status === 'rejected' ? rejectReason : null })
            setRejectModal(null); setRejectReason(''); await fetchAll()
        } catch (e) { alert(e.response?.data?.detail || 'Failed') }
    }

    const handleCancel = async (leaveId) => {
        if (!confirm('Cancel this leave request?')) return
        await API.delete(`/leave/${leaveId}`); await fetchAll()
    }

    const days = form.from_date && form.to_date
        ? Math.max(0, (new Date(form.to_date) - new Date(form.from_date)) / 86400000 + 1) : 0

    const handleLogout = () => { localStorage.removeItem('token'); navigate('/') }

    const card = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '28px', boxShadow: 'var(--shadow-sm)' }
    const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-xs)', border: '1.5px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }
    const labelStyle = { display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px', fontWeight: '500' }

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: '40px 48px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>Leave</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage your time off requests</p>
                    </div>
                    <button onClick={() => setShowForm(true)} style={{
                        padding: '12px 24px', borderRadius: 'var(--radius-sm)', border: 'none',
                        background: 'var(--bg-dark)', color: '#fff', fontSize: '14px', fontWeight: '600',
                        cursor: 'pointer', transition: 'opacity 0.2s',
                    }} onMouseEnter={e => e.target.style.opacity = '0.85'} onMouseLeave={e => e.target.style.opacity = '1'}>
                        + Apply
                    </button>
                </div>

                {/* Balance cards */}
                {balance && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                        {[['Sick', 'sick', 'var(--info)'], ['Casual', 'casual', '#8b5cf6'], ['Annual', 'annual', 'var(--success)']].map(([label, key, color]) => (
                            <div key={key} style={{ ...card, textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>{label}</p>
                                <p style={{ fontSize: '40px', fontWeight: '700', margin: 0, color }}>{balance[key]}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '4px 0 0' }}>days left</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                {user?.role === 'admin' && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-card)', padding: '6px', borderRadius: 'var(--radius-sm)', width: 'fit-content', border: '1px solid var(--border-light)' }}>
                        {['my', 'admin'].map(t => (
                            <button key={t} onClick={() => setTab(t)} style={{
                                padding: '10px 24px', borderRadius: 'var(--radius-xs)', border: 'none', cursor: 'pointer',
                                background: tab === t ? 'var(--bg-dark)' : 'transparent',
                                color: tab === t ? '#fff' : 'var(--text-secondary)', fontSize: '14px', fontWeight: '500',
                                transition: 'all 0.2s',
                            }}>
                                {t === 'my' ? 'My Leaves' : 'All Requests'}
                                {t === 'admin' && adminLeaves.filter(l => l.status === 'pending').length > 0 && (
                                    <span style={{ marginLeft: '8px', background: 'var(--error)', color: '#fff', fontSize: '11px', padding: '1px 6px', borderRadius: '99px' }}>
                                        {adminLeaves.filter(l => l.status === 'pending').length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* My leaves */}
                {tab === 'my' && (
                    <div style={card}>
                        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 20px' }}>My Requests</h2>
                        {leaves.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>No leave requests yet</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {leaves.map(l => (
                                    <div key={l.id} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', border: '1px solid var(--border-light)' }}>
                                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                            <span style={{ background: TYPE_COLORS[l.leave_type].bg, color: TYPE_COLORS[l.leave_type].text, fontSize: '12px', padding: '4px 12px', borderRadius: '99px', textTransform: 'capitalize', whiteSpace: 'nowrap', fontWeight: '500', border: `1px solid ${TYPE_COLORS[l.leave_type].border}` }}>
                                                {l.leave_type}
                                            </span>
                                            <div>
                                                <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>{fmtDate(l.from_date)} → {fmtDate(l.to_date)} <span style={{ color: 'var(--text-muted)' }}>({l.days}d)</span></p>
                                                {l.reason && <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>{l.reason}</p>}
                                                {l.status === 'rejected' && l.rejection_reason && (
                                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--error)' }}>Reason: {l.rejection_reason}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                            <span style={{ background: STATUS_COLORS[l.status].bg, color: STATUS_COLORS[l.status].text, fontSize: '12px', padding: '4px 12px', borderRadius: '99px', textTransform: 'capitalize', fontWeight: '500', border: `1px solid ${STATUS_COLORS[l.status].border}` }}>
                                                {l.status}
                                            </span>
                                            {l.status === 'pending' && (
                                                <button onClick={() => handleCancel(l.id)} style={{ background: 'var(--error-bg)', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '14px', padding: '6px', borderRadius: 'var(--radius-xs)' }}>✕</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Admin view */}
                {tab === 'admin' && user?.role === 'admin' && (
                    <div style={card}>
                        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 20px' }}>All Leave Requests</h2>
                        {adminLeaves.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>No requests</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {adminLeaves.map(l => (
                                    <div key={l.id} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '18px 20px', border: '1px solid var(--border-light)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                <span style={{ background: TYPE_COLORS[l.leave_type].bg, color: TYPE_COLORS[l.leave_type].text, fontSize: '12px', padding: '4px 12px', borderRadius: '99px', textTransform: 'capitalize', whiteSpace: 'nowrap', fontWeight: '500', border: `1px solid ${TYPE_COLORS[l.leave_type].border}` }}>
                                                    {l.leave_type}
                                                </span>
                                                <div>
                                                    <p style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{l.employee_name}</p>
                                                    <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>{fmtDate(l.from_date)} → {fmtDate(l.to_date)} · {l.days}d</p>
                                                    {l.reason && <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{l.reason}</p>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                {l.status === 'pending' ? (
                                                    <>
                                                        <button onClick={() => handleReview(l.id, 'approved')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--success)', background: 'var(--success-bg)', color: 'var(--success)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Approve</button>
                                                        <button onClick={() => { setRejectModal(l.id); setRejectReason('') }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--error)', background: 'var(--error-bg)', color: 'var(--error)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Reject</button>
                                                    </>
                                                ) : (
                                                    <span style={{ background: STATUS_COLORS[l.status].bg, color: STATUS_COLORS[l.status].text, fontSize: '12px', padding: '4px 12px', borderRadius: '99px', textTransform: 'capitalize', fontWeight: '500', border: `1px solid ${STATUS_COLORS[l.status].border}` }}>
                                                        {l.status}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {l.status === 'rejected' && l.rejection_reason && (
                                            <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--error)' }}>Reason: {l.rejection_reason}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Apply modal */}
            {showForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(4px)' }} onClick={() => setShowForm(false)}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '460px', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 24px', fontSize: '20px', fontWeight: '700' }}>Apply for Leave</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Leave Type</label>
                                <select style={inputStyle} value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}>
                                    <option value="casual">Casual</option>
                                    <option value="sick">Sick</option>
                                    <option value="annual">Annual</option>
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div><label style={labelStyle}>From</label><input type="date" style={inputStyle} value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} /></div>
                                <div><label style={labelStyle}>To</label><input type="date" style={inputStyle} value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} /></div>
                            </div>
                            {days > 0 && <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{days} day{days > 1 ? 's' : ''} · {balance?.[form.leave_type]} available</p>}
                            <div>
                                <label style={labelStyle}>Reason (optional)</label>
                                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }} placeholder="Brief reason..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                            </div>
                            {formError && <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '12px 16px', borderRadius: 'var(--radius-xs)', fontSize: '14px' }}>{formError}</div>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                            <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Cancel</button>
                            <button onClick={handleApply} disabled={formLoading} style={{ padding: '10px 20px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--bg-dark)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', opacity: formLoading ? 0.5 : 1 }}>
                                {formLoading ? 'Applying...' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject modal */}
            {rejectModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(4px)' }} onClick={() => setRejectModal(null)}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '700' }}>Rejection Reason</h2>
                        <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} placeholder="Optional — explain why..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                            <button onClick={() => setRejectModal(null)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Cancel</button>
                            <button onClick={() => handleReview(rejectModal, 'rejected')} style={{ padding: '10px 20px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--error)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Reject</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
