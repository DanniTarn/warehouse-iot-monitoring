import { create } from 'zustand'
import { api } from '../services/api'
import type { User } from '../services/types'
const SESSION_KEY = 'warehouse.session'
interface AuthState {
  user: User | null
  token: string | null
  ready: boolean
  initialize: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}
export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  ready: false,
  async initialize() {
    const token = sessionStorage.getItem(SESSION_KEY)
    if (!token) {
      set({ ready: true })
      return
    }
    try {
      set({ user: await api.me(token), token, ready: true })
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
      set({ user: null, token: null, ready: true })
    }
  },
  async login(username, password) {
    const session = await api.login(username, password)
    sessionStorage.setItem(SESSION_KEY, session.token)
    set({ ...session, ready: true })
  },
  logout() {
    sessionStorage.removeItem(SESSION_KEY)
    set({ user: null, token: null, ready: true })
  },
}))
