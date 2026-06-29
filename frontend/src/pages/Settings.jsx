import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'
import { HiCog6Tooth, HiCheckCircle, HiExclamationTriangle } from 'react-icons/hi2'

export default function Settings({ user }) {
    const [settings, setSettings] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        API.get('/settings/attendance').then(r => setSettings(r.data)).finally(() => setLoading(false))
    }, [])

    const handleLogout = () => { localStorage.removeItem('token'); navigate('/') }

    const handleSourceChange = async (source) => {
        setSaving(true); setMessage(null)
        try {
            const res = await API.put('/settings/attendance', { source })
            setSettings(prev => ({ ...prev, attendance_source: source }))
            setMessage({ type: 'success', text: res.data.message })
        } catch (e) {
            setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to update' })
        } finally { setSaving(false) }
    }

    const card = { background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', marginBottom: '20px' }

    const radioOption = (value, label, description, disabled = false) => (
        <label style={{
            display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px',
            borderRadius: 'var(--radius-xs)', border: `1.5px solid ${settings?.attendance_source === value ? 'var(--bg-dark)' : 'var(--border)'}`,
            background: settings?.attendance_source === value ? 'var(--bg)' : 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
            transition: 'all 0.15s',
        }}>
            <input
                type="radio"
                name="attendance_source"
                value={value}
                checked={settings?.attendance_source === value}
                onChange={() => !disabled && handleSourceChange(value)}
                disabled={disabled || saving}
                style={{ marginTop: '2px', accentColor: 'var(--bg-dark)' }}
            />
            <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>{label}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{description}</p>
            </div>
        </label>
    )

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div style={{ padding: '20px 28px 28px' }}>
                <div style={{ marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '2px' }}>Settings</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Manage system configuration and integrations</p>
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading...</p>
                ) : (
                    <>
                        {/* Attendance Integration */}
                        <div style={card}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <HiCog6Tooth size={20} color="var(--text-secondary)" />
                                <div>
                                    <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Attendance Integration</h2>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Configure where attendance data comes from</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                                {radioOption(
                                    'manual',
                                    'Manual',
                                    'Employees punch in/out through the Xarka web interface'
                                )}
                                {radioOption(
                                    'essl',
                                    'eSSL Biometric (Coming Soon)',
                                    'Attendance captured from eSSL biometric devices. Phase 2 integration.',
                                    true
                                )}
                            </div>

                            {message && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                                    borderRadius: 'var(--radius-xs)', fontSize: '13px',
                                    background: message.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                                    color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
                                }}>
                                    {message.type === 'success' ? <HiCheckCircle size={16} /> : <HiExclamationTriangle size={16} />}
                                    {message.text}
                                </div>
                            )}
                        </div>

                        {/* Biometric Device Config (placeholder) */}
                        <div style={{ ...card, opacity: 0.6 }}>
                            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Device Configuration</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                Device settings will be available once eSSL integration is enabled.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', pointerEvents: 'none' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>Device IP</label>
                                    <input
                                        type="text"
                                        value={settings?.essl_device_ip || '192.168.1.100'}
                                        disabled
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-xs)',
                                            border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '13px', color: 'var(--text-muted)',
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>Port</label>
                                    <input
                                        type="text"
                                        value={settings?.essl_device_port || '4370'}
                                        disabled
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-xs)',
                                            border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '13px', color: 'var(--text-muted)',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Integration Status */}
                        <div style={card}>
                            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Integration Roadmap</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {[
                                    { phase: 'Phase 1', status: 'done', label: 'Architecture preparation', detail: 'Database schema, service interfaces, settings UI' },
                                    { phase: 'Phase 2', status: 'upcoming', label: 'eSSL biometric device integration', detail: 'MDB file reading, device communication, auto-sync' },
                                    { phase: 'Phase 3', status: 'upcoming', label: 'Multi-device support', detail: 'Multiple device management, ZKTeco support' },
                                ].map(item => (
                                    <div key={item.phase} style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                                        borderRadius: 'var(--radius-xs)', background: 'var(--bg)',
                                    }}>
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                            background: item.status === 'done' ? 'var(--success)' : 'var(--text-muted)',
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>
                                                {item.phase}: {item.label}
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{item.detail}</p>
                                        </div>
                                        <span style={{
                                            fontSize: '10px', padding: '2px 8px', borderRadius: '99px', fontWeight: '600',
                                            background: item.status === 'done' ? 'var(--success-bg)' : 'var(--bg-card)',
                                            color: item.status === 'done' ? 'var(--success)' : 'var(--text-muted)',
                                            border: item.status === 'done' ? 'none' : '1px solid var(--border)',
                                        }}>
                                            {item.status === 'done' ? 'Complete' : 'Upcoming'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    )
}
