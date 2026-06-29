import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { HiPlus, HiPencilSquare, HiTrash } from 'react-icons/hi2'

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '13px', outline: 'none' }
const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }
const card = { background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', marginBottom: '20px' }

function DepartmentManagementInner({ user }) {
  const [departments, setDepartments] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const load = () => { API.get('/departments').then(r => setDepartments(r.data)).catch(() => {}) }
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditItem(null); setForm({ name: '', description: '' }); setShowModal(true) }
  const openEdit = (dept) => { setEditItem(dept); setForm({ name: dept.name, description: dept.description || '' }); setShowModal(true) }

  const handleSave = async () => {
    setSaving(true); setMessage(null)
    try {
      if (editItem) {
        await API.put(`/departments/${editItem.id}`, form)
        setMessage({ type: 'success', text: 'Department updated' })
      } else {
        await API.post('/departments', form)
        setMessage({ type: 'success', text: 'Department created' })
      }
      load()
      setTimeout(() => { setShowModal(false); setMessage(null) }, 1500)
    } catch (e) { setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed' }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (dept) => {
    if (!window.confirm(`Deactivate "${dept.name}"?`)) return
    try { await API.delete(`/departments/${dept.id}`); load() } catch (e) { alert(e.response?.data?.detail || 'Failed') }
  }

  return (
    <Layout user={user} onLogout={() => { localStorage.removeItem('token'); navigate('/') }}>
      <div style={{ padding: '20px 28px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '2px' }}>Departments</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Manage organizational departments</p>
          </div>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            <HiPlus size={16} /> Add Department
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {departments.map(dept => (
            <div key={dept.id} style={{ ...card, marginBottom: 0, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>{dept.name}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{dept.description || 'No description'}</p>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => openEdit(dept)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><HiPencilSquare size={16} /></button>
                  <button onClick={() => handleDelete(dept)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '4px' }}><HiTrash size={16} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{dept.employee_count} employee{dept.employee_count !== 1 ? 's' : ''}</span>
                <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '600', background: dept.is_active ? 'var(--success-bg)' : 'var(--error-bg)', color: dept.is_active ? 'var(--success)' : 'var(--error)' }}>
                  {dept.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
          {departments.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No departments yet</div>
          )}
        </div>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', width: '400px', boxShadow: 'var(--shadow)' }} onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>{editItem ? 'Edit Department' : 'Add Department'}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div><label style={labelStyle}>Name *</label><input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><label style={labelStyle}>Description</label><input style={inputStyle} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
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

export default function DepartmentManagement() {
  return <ProtectedRoute adminOnly><DepartmentManagementInner /></ProtectedRoute>
}
