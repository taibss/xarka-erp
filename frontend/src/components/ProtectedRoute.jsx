import { useEffect, useState, cloneElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe } from '../api'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/')
      return
    }
    getMe()
      .then(res => {
        setUser(res.data)
        if (!res.data.is_active) {
          localStorage.removeItem('token')
          navigate('/')
          return
        }
        if (adminOnly && res.data.role !== 'admin') {
          navigate('/dashboard')
          return
        }
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem('token')
        navigate('/')
      })
  }, [navigate, adminOnly])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg)',
        color: 'var(--text-muted)',
        fontSize: '14px',
      }}>
        Loading...
      </div>
    )
  }

  return cloneElement(children, { user })
}
