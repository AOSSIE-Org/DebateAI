import {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import { useNavigate } from 'react-router-dom'

const baseURL = import.meta.env.VITE_BASE_URL

interface AuthContextType {
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  handleError: (error: string) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  signup: (email: string, password: string) => Promise<void>
  verifyEmail: (email: string, code: string) => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  confirmForgotPassword: (
    email: string,
    code: string,
    newPassword: string
  ) => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred'
    setError(message)
    throw error
  }

  const verifyToken = useCallback(async () => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) return

    try {
      const response = await fetch(`${baseURL}/verifyToken`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      })

      if (!response.ok) throw new Error('Token expired or invalid')
      setToken(storedToken)
    } catch (error) {
      console.log(error)
      logout()
    }
  }, [])

  useEffect(() => {
    verifyToken()
  }, [verifyToken])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const response = await fetch(`${baseURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Login failed')

      setToken(data.accessToken)
      localStorage.setItem('token', data.accessToken)
      navigate('/')
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
    }
  }

  const signup = async (email: string, password: string) => {
    setLoading(true)
    try {
      const response = await fetch(`${baseURL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Signup failed')
      }
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
    }
  }

  const verifyEmail = async (email: string, code: string) => {
    setLoading(true)
    try {
      const response = await fetch(`${baseURL}/verifyEmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, confirmationCode: code }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Verification failed')
      }
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
    }
  }

  const forgotPassword = async (email: string) => {
    setLoading(true)
    try {
      const response = await fetch(`${baseURL}/forgotPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Password reset failed')
      }
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
    }
  }

  const confirmForgotPassword = async (
    email: string,
    code: string,
    newPassword: string
  ) => {
    setLoading(true)
    try {
      const response = await fetch(`${baseURL}/confirmForgotPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Password update failed')
      }
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setToken(null)
    localStorage.removeItem('token')
    navigate('/auth')
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        loading,
        error,
        handleError,
        login,
        logout,
        signup,
        verifyEmail,
        forgotPassword,
        confirmForgotPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
