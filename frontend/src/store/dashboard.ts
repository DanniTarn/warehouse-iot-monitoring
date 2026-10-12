import { create } from 'zustand'
import { api, type DashboardData } from '../services/api'
interface DashboardState {
  data: DashboardData | null
  loading: boolean
  error: string
  load: (token: string) => Promise<void>
  reset: () => void
}
let request = 0
export const useDashboard = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: '',
  async load(token) {
    const current = ++request
    set({ loading: true, error: '', data: null })
    try {
      const data = await api.dashboard(token)
      if (current === request) set({ data, loading: false })
    } catch (error) {
      if (current === request)
        set({
          error: error instanceof Error ? error.message : 'Không kết nối được máy chủ.',
          loading: false,
        })
    }
  },
  reset() {
    request++
    set({ data: null, loading: false, error: '' })
  },
}))
