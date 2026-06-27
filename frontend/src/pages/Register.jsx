import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', phone: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await API.post('/auth/register', form)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text)',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
      <div style={{ background: 'var(--bg-card)', padding: '48px 40px', borderRadius: '24px', width: '100%', maxWidth: '420px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px', background: 'var(--bg-dark)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: '700', color: '#fff', marginBottom: '16px',
          }}>X</div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
            XARKA <span style={{ color: 'var(--accent)' }}>Outbound</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Create your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Full Name</label>
            <input name="name" value={form.name} onChange={handleChange} required placeholder="John Doe" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="you@xarka.com" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} required placeholder="Min 6 characters" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Department</label>
              <input name="department" value={form.department} onChange={handleChange} placeholder="Optional" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="Optional" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '12px 16px', borderRadius: 'var(--radius-xs)', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button type="submit" style={{
            width: '100%', padding: '14px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--bg-dark)', color: '#fff', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
            transition: 'opacity 0.2s',
          }} onMouseEnter={e => e.target.style.opacity = '0.85'} onMouseLeave={e => e.target.style.opacity = '1'}>
            Create Account
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Already have an account? <a href="/" style={{ color: 'var(--accent)', fontWeight: '500' }}>Sign in</a>
        </p>
      </div>
    </div>
  )
}
