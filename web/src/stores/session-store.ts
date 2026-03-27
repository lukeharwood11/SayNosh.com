import { create } from 'zustand'
import type { Database } from '@/types/database'

type Session = Database['public']['Tables']['sessions']['Row']
type SessionMember = Database['public']['Tables']['session_members']['Row']
type Restaurant = Database['public']['Tables']['restaurants']['Row']

export type Vote = 'yes' | 'no' | 'neutral'

interface MatchResult {
  type: 'strong' | 'soft' | 'fallback'
  restaurants: Restaurant[]
  winner?: Restaurant
}

interface SessionState {
  session: Session | null
  members: SessionMember[]
  restaurants: Restaurant[]
  currentCardIndex: number
  votes: Record<string, Vote>
  matchResult: MatchResult | null
  memberId: string | null

  setSession: (session: Session | null) => void
  setMembers: (members: SessionMember[]) => void
  updateMember: (id: string, updates: Partial<SessionMember>) => void
  setRestaurants: (restaurants: Restaurant[]) => void
  setCurrentCardIndex: (index: number) => void
  addVote: (restaurantId: string, vote: Vote) => void
  clearVotes: () => void
  setMatchResult: (result: MatchResult | null) => void
  setMemberId: (id: string | null) => void
  reset: () => void
}

const initialState = {
  session: null,
  members: [],
  restaurants: [],
  currentCardIndex: 0,
  votes: {} as Record<string, Vote>,
  matchResult: null,
  memberId: null,
}

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,
  setSession: (session) => set({ session }),
  setMembers: (members) => set({ members }),
  updateMember: (id, updates) =>
    set((state) => ({
      members: state.members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  setRestaurants: (restaurants) => set({ restaurants }),
  setCurrentCardIndex: (currentCardIndex) => set({ currentCardIndex }),
  addVote: (restaurantId, vote) =>
    set((state) => ({ votes: { ...state.votes, [restaurantId]: vote } })),
  clearVotes: () => set({ votes: {} }),
  setMatchResult: (matchResult) => set({ matchResult }),
  setMemberId: (memberId) => set({ memberId }),
  reset: () => set(initialState),
}))
