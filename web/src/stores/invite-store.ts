import { create } from 'zustand'

export interface PendingInvite {
  id: string
  session_id: string
  inviter_name: string
  invite_code: string
}

interface InviteState {
  invites: PendingInvite[]
  addInvite: (invite: PendingInvite) => void
  removeInvite: (id: string) => void
  clear: () => void
}

export const useInviteStore = create<InviteState>((set) => ({
  invites: [],
  addInvite: (invite) =>
    set((state) => {
      if (state.invites.some((i) => i.id === invite.id)) return state
      return { invites: [...state.invites, invite] }
    }),
  removeInvite: (id) =>
    set((state) => ({
      invites: state.invites.filter((i) => i.id !== id),
    })),
  clear: () => set({ invites: [] }),
}))
