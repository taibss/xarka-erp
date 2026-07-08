import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'
import { HiPlus, HiMagnifyingGlass, HiPencilSquare, HiTrash, HiArrowPath, HiKey } from 'react-icons/hi2'

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-xs)',
  border: '1px solid var(--border)', background: 'var(--bg-input)',
  color: 'var(--text)', fontSize: '13px', outline: 'none',
}
const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }
const card = { background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', marginBottom: '20px' }

export default function EmployeeManagement({ user }) {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [designations, setDesignations] = useState([])
  const [managers, setManagers] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editEmployee, setEditEmployee] = useState(null)
  const [form, setForm] = useState({})
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const load = () => {
    API.get('/employees').then(r => setEmployees(r.data)).catch(() => {})
    API.get('/departments/all').then(r => setDepartments(r.data)).catch(() => {})
    API.get('/designations/all').then(r => setDesignations(r.data)).catch(() => {})
    API.get('/employees/active').then(r => setManagers(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const filtered = employees.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' ||
      (filter === 'active' && e.is_active) ||
      (filter === 'inactive' && !e.is_active) ||
      (filter === 'admin' && e.role === 'admin')
    return matchSearch && matchFilter
  }).sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1))

  const openAdd = () => {
    setEditEmployee(null)
    setForm({ name: '', email: '', phone: '', department: '', department_id: '', designation: '', designation_id: '', manager_id: '', role: 'employee', joining_date: '' })
    setShowModal(true)
  }

  const openEdit = (emp) => {
    setEditEmployee(emp)
    setForm({
      name: emp.name, email: emp.email, phone: emp.phone || '',
      department: emp.department || '', department_id: emp.department_id || '',
      designation: emp.designation || '', designation_id: emp.designation_id || '',
      manager_id: emp.manager_id || '', role: emp.role,
      is_active: emp.is_active, joining_date: emp.joining_date || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true); setMessage(null)
    try {
      const cleanInt = (v) => (v === '' || v === null || v === undefined) ? null : parseInt(v)
      const cleanDate = (v) => (!v || v === '') ? null : v
      const payload = {
        ...form,
        department_id: cleanInt(form.department_id),
        designation_id: cleanInt(form.designation_id),
        manager_id: cleanInt(form.manager_id),
        joining_date: cleanDate(form.joining_date),
      }
      if (editEmployee) {
        await API.put(`/employees/${editEmployee.id}`, payload)
        setMessage({ type: 'success', text: 'Employee updated' })
      } else {
        const res = await API.post('/employees', payload)
        setMessage({ type: 'success', text: `Employee created. Temporary password: ${res.data.temporary_password}` })
      }
      load()
      setTimeout(() => { setShowModal(false); setMessage(null) }, 3000)
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed' })
    } finally { setSaving(false) }
  }

  const handleDeactivate = async (emp) => {
    if (!window.confirm(`Deactivate ${emp.name}?`)) return
    try {
      await API.delete(`/employees/${emp.id}`)
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed')
    }
  }

  const handleReactivate = async (emp) => {
    try {
      await API.post(`/employees/${emp.id}/reactivate`)
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed')
    }
  }

  const handleResetPassword = async (emp) => {
    if (!window.confirm(`Reset password for ${emp.name}?`)) return
    try {
      const res = await API.post(`/employees/${emp.id}/reset-password`)
      alert(`New password: ${res.data.temporary_password}`)
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed')
    }
  }

  return (
    <Layout user={user} onLogout={() => { localStorage.removeItem('token'); navigate('/') }}>
      <div style={{ padding: '20px 28px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '2px' }}>Employee Management</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Manage employee accounts, roles, and assignments</p>
          </div>
          <button onClick={openAdd} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
            borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--accent)',
            color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
          }}>
            <HiPlus size={16} /> Add Employee
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input placeholder="Search by name, email, or department..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, padding: '10px 14px' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[{ k: 'all', l: 'All' }, { k: 'active', l: 'Active' }, { k: 'inactive', l: 'Inactive' }, { k: 'admin', l: 'Admins' }].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)} style={{
                padding: '8px 14px', borderRadius: '99px', border: 'none', cursor: 'pointer',
                background: filter === f.k ? 'var(--accent)' : 'var(--bg-card)',
                color: filter === f.k ? '#fff' : 'var(--text-secondary)',
                fontSize: '13px', fontWeight: '500',
              }}>{f.l}</button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total', value: employees.length, color: 'var(--accent)' },
            { label: 'Active', value: employees.filter(e => e.is_active).length, color: 'var(--success)' },
            { label: 'Inactive', value: employees.filter(e => !e.is_active).length, color: 'var(--error)' },
            { label: 'Admins', value: employees.filter(e => e.role === 'admin').length, color: 'var(--warning)' },
          ].map(s => (
            <div key={s.label} style={{ ...card, padding: '16px 20px', marginBottom: 0, textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Employee', 'Department', 'Designation', 'Manager', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: '600', color: '#fff', flexShrink: 0,
                      }}>{emp.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: '500', color: 'var(--text)' }}>{emp.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{emp.department || '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{emp.designation || '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{emp.manager_name || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '600',
                      background: emp.role === 'admin' ? 'var(--warning-bg)' : 'var(--bg)',
                      color: emp.role === 'admin' ? 'var(--warning)' : 'var(--text-secondary)',
                    }}>{emp.role}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '600',
                      background: emp.is_active ? 'var(--success-bg)' : 'var(--error-bg)',
                      color: emp.is_active ? 'var(--success)' : 'var(--error)',
                    }}>{emp.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => openEdit(emp)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><HiPencilSquare size={16} /></button>
                      <button onClick={() => handleResetPassword(emp)} title="Reset password" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><HiKey size={16} /></button>
                      {emp.is_active ? (
                        <button onClick={() => handleDeactivate(emp)} title="Deactivate" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '4px' }}><HiTrash size={16} /></button>
                      ) : (
                        <button onClick={() => handleReactivate(emp)} title="Reactivate" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', padding: '4px' }}><HiArrowPath size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => setShowModal(false)}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', width: '520px', maxHeight: '85vh', overflow: 'auto', boxShadow: 'var(--shadow)' }}
              onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>{editEmployee ? 'Edit Employee' : 'Add Employee'}</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Name *</label>
                  <input style={inputStyle} value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input style={inputStyle} type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Department</label>
                  <select style={inputStyle} value={form.department_id || ''} onChange={e => {
                    const dept = departments.find(d => d.id === parseInt(e.target.value))
                    setForm({ ...form, department_id: e.target.value, department: dept?.name || '' })
                  }}>
                    <option value="">Select...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Designation</label>
                  <select style={inputStyle} value={form.designation_id || ''} onChange={e => {
                    const des = designations.find(d => d.id === parseInt(e.target.value))
                    setForm({ ...form, designation_id: e.target.value, designation: des?.name || '' })
                  }}>
                    <option value="">Select...</option>
                    {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Manager</label>
                  <select style={inputStyle} value={form.manager_id || ''} onChange={e => setForm({ ...form, manager_id: e.target.value })}>
                    <option value="">None</option>
                    {managers.filter(m => m.id !== editEmployee?.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Role</label>
                  <select style={inputStyle} value={form.role || 'employee'} onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Joining Date</label>
                  <input style={inputStyle} type="date" value={form.joining_date || ''} onChange={e => setForm({ ...form, joining_date: e.target.value })} />
                </div>
              </div>

              {message && (
                <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: 'var(--radius-xs)', fontSize: '13px',
                  background: message.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                  color: message.type === 'success' ? 'var(--success)' : 'var(--error)', wordBreak: 'break-all' }}>
                  {message.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '9px 16px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '9px 16px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : editEmployee ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
