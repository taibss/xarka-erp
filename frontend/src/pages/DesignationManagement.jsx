import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { HiPlus, HiPencilSquare, HiTrash } from 'react-icons/hi2'

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '13px', outline: 'none' }
const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }
const card = { background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', marginBottom: '20px' }

function DesignationManagementInner({ user }) {
  const [designations, setDesignations] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', level: 1 })
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const load = () => { API.get('/designations').then(r => setDesignations(r.data)).catch(() => {}) }
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditItem(null); setForm({ name: '', description: '', level: 1 }); setShowModal(true) }
  const openEdit = (des) => { setEditItem(des); setForm({ name: des.name, description: des.description || '', level: des.level }); setShowModal(true) }

  const handleSave = async () => {
    setSaving(true); setMessage(null)
    try {
      const payload = { ...form, level: parseInt(form.level) || 1 }
      if (editItem) {
        await API.put(`/designations/${editItem.id}`, payload)
        setMessage({ type: 'success', text: 'Designation updated' })
      } else {
        await API.post('/designations', payload)
        setMessage({ type: 'success', text: 'Designation created' })
      }
      load()
      setTimeout(() => { setShowModal(false); setMessage(null) }, 1500)
    } catch (e) { setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed' }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (des) => {
    if (!window.confirm(`Deactivate "${des.name}"?`)) return
    try { await API.delete(`/designations/${des.id}`); load() } catch (e) { alert(e.response?.data?.detail || 'Failed') }
  }

  return (
    <Layout user={user} onLogout={() => { localStorage.removeItem('token'); navigate('/') }}>
      <div style={{ padding: '20px 28px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '2px' }}>Designations</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Manage job titles and levels</p>
          </div>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            <HiPlus size={16} /> Add Designation
          </button>
        </div>

        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Description', 'Level', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {designations.map(des => (
                <tr key={des.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '500', color: 'var(--text)' }}>{des.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{des.description || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '600', background: 'var(--bg)', color: 'var(--text-secondary)' }}>L{des.level}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '600', background: des.is_active ? 'var(--success-bg)' : 'var(--error-bg)', color: des.is_active ? 'var(--success)' : 'var(--error)' }}>
                      {des.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => openEdit(des)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><HiPencilSquare size={16} /></button>
                      <button onClick={() => handleDelete(des)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '4px' }}><HiTrash size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {designations.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No designations yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', width: '400px', boxShadow: 'var(--shadow)' }} onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>{editItem ? 'Edit Designation' : 'Add Designation'}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div><label style={labelStyle}>Name *</label><input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><label style={labelStyle}>Description</label><input style={inputStyle} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div><label style={labelStyle}>Level</label><input style={inputStyle} type="number" min="1" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} /></div>
              </div>
              {message && (
                <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: 'var(--radius-xs)', fontSize: '13px', background: message.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)', color: message.type === 'success' ? 'var(--success)' : 'var(--error)' }}>{message.text}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '9px 16px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '9px 16px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function DesignationManagement() {
  return <ProtectedRoute adminOnly><DesignationManagementInner /></ProtectedRoute>
}
