import { create } from 'zustand'

interface PresenceState {
  onlineUserIds: Set<string>
  setOnlineUserIds: (ids: Set<string>) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUserIds: new Set(),
  setOnlineUserIds: (ids) => set({ onlineUserIds: ids }),
}))
