import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import API from '../api'
import Layout from '../components/Layout'
import { HiDocumentArrowDown } from 'react-icons/hi2'

export default function Reports({ user }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [employees, setEmployees] = useState([])
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [endDate, setEndDate] = useState(() => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  })
  const [selectedEmpId, setSelectedEmpId] = useState(searchParams.get('employee_id') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogout = () => { localStorage.removeItem('token'); navigate('/') }

  useEffect(() => {
    API.get('/employees/active')
      .then(r => setEmployees(r.data))
      .catch(() => {})
  }, [])

  const download = async (format) => {
    setLoading(true)
    setError('')
    try {
      const params = {
        start_date: startDate,
        end_date: endDate,
        format,
      }
      if (selectedEmpId) params.employee_id = selectedEmpId

      const response = await API.get('/reports/attendance', {
        params,
        responseType: 'blob',
      })

      const ext = format === 'xlsx' ? 'xlsx' : 'pdf'
      const filename = `attendance_report_${startDate}_to_${endDate}.${ext}`
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const card = { background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)' }

  const inputStyle = {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 'var(--radius-xs)',
    border: '1px solid var(--border)',
    fontSize: '13px',
    background: 'var(--bg)',
    color: 'var(--text)',
    outline: 'none',
  }

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <div style={{ padding: '20px 28px 28px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '2px' }}>Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Export attendance data as Excel or PDF</p>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Date range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={labelStyle}>Date Range:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Employee filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={labelStyle}>Employee:</label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '10px 14px', borderRadius: 'var(--radius-xs)', fontSize: '13px' }}>
                {error}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
              <button
                onClick={() => download('xlsx')}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  background: 'var(--success)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <HiDocumentArrowDown size={16} />
                {loading ? 'Generating...' : 'Download Excel'}
              </button>

              <button
                onClick={() => download('pdf')}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  background: 'var(--error)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <HiDocumentArrowDown size={16} />
                {loading ? 'Generating...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
