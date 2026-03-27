import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/Header'
import { WaitingRoom } from '@/components/session/WaitingRoom'
import { SwipeDeck } from '@/components/session/SwipeDeck'
import { WaitingForOthers } from '@/components/session/WaitingForOthers'
import { ResultScreen } from '@/components/session/ResultScreen'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { useSession } from '@/hooks/use-session'
import { useAuth } from '@/hooks/use-auth'
import type { Vote } from '@/stores/session-store'
import { useSessionStore } from '@/stores/session-store'
import { supabase } from '@/lib/supabase'
import { invokeAuthenticatedFunction } from '@/lib/supabase-functions'
import { useOnlinePresence } from '@/hooks/use-online-presence'
import { useInviteListener } from '@/hooks/use-invite-listener'

interface ResultRestaurant {
  id: string
  name: string
  match_type: string
  rating: number | null
  price_level: number | null
  image_url: string | null
  address: string | null
}

interface CalculateResultsResponse {
  status: 'completed'
  round: number
  match_type: 'strong' | 'soft' | 'fallback'
  winner: ResultRestaurant | null
  matches: ResultRestaurant[]
}

export function SessionPage() {
  useOnlinePresence()
  useInviteListener()

  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const {
    session,
    members,
    restaurants,
    memberId,
    setMemberId,
    addVote,
    fetchSession,
    fetchRestaurants,
    submitSwipes,
    skipMember,
  } = useSession(id)

  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [swipeError, setSwipeError] = useState<string | null>(null)
  const [isResolvingResults, setIsResolvingResults] = useState(false)
  const [swipeDeckKey, setSwipeDeckKey] = useState(0)

  const isHost = user?.id === session?.host_id
  const memberSubmissionState = members.find((m) => m.id === memberId)
  const hasSubmittedForRound = hasSubmitted || !!memberSubmissionState?.has_submitted

  const {
    data: resultsData,
    isPending: resultsPending,
    isError: resultsIsError,
    refetch: refetchResults,
  } = useQuery({
    queryKey: ['calculate-results', id],
    queryFn: async (): Promise<CalculateResultsResponse> => {
      const { data, error } = await invokeAuthenticatedFunction<CalculateResultsResponse>(
        'calculate-results',
        { body: { session_id: id! } },
      )
      if (error) throw error
      if (!data) throw new Error('No results from server')
      return data
    },
    enabled: Boolean(id && session?.status === 'completed'),
    staleTime: Infinity,
  })

  const matchResult = useMemo(() => {
    if (!resultsData) return null
    return {
      type: resultsData.match_type ?? 'fallback',
      winners: resultsData.matches?.length
        ? resultsData.matches
        : resultsData.winner
          ? [resultsData.winner]
          : [],
    }
  }, [resultsData])

  const fetchAndSetResults = useCallback(
    async (sessionId: string, autoPick = false) => {
      const { data, error } = await invokeAuthenticatedFunction<CalculateResultsResponse>(
        'calculate-results',
        { body: { session_id: sessionId, auto_pick: autoPick } },
      )
      if (error || !data) return null
      queryClient.setQueryData(['calculate-results', sessionId], data)
      return data
    },
    [queryClient],
  )

  useEffect(() => {
    if (!id || !user) return

    const findOrSetMember = async () => {
      const { data } = await supabase
        .from('session_members')
        .select('id, has_submitted')
        .eq('session_id', id)
        .eq('user_id', user.id)
        .single()

      if (data) {
        setMemberId(data.id)
        setHasSubmitted(data.has_submitted)
      }
      setLoading(false)
    }

    void findOrSetMember()
  }, [id, user, setMemberId])

  useEffect(() => {
    if (!id || !session) return
    const round = session.status === 'round_two' ? 2 : 1
    if (session.status === 'swiping' || session.status === 'round_two') {
      void fetchRestaurants(id, round)
    }
  }, [id, session, fetchRestaurants])

  useEffect(() => {
    if (!session) return
    if ((session.status === 'swiping' || session.status === 'round_two') && memberSubmissionState && !memberSubmissionState.has_submitted) {
      setHasSubmitted(false)
    }
  }, [session, memberSubmissionState])

  const handleStartSwiping = useCallback(async () => {
    if (!id) return
    // Let the pointer sequence finish before swapping UI (avoids tap-through onto the swipe deck).
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    await supabase
      .from('sessions')
      .update({ status: 'swiping' })
      .eq('id', id)
    fetchSession(id)
  }, [id, fetchSession])

  const handleVote = useCallback((restaurantId: string, vote: Vote) => {
    addVote(restaurantId, vote)
  }, [addVote])

  const handleSwipeComplete = useCallback(async () => {
    if (!id || !memberId) return
    setSwipeError(null)
    const latestVotes = useSessionStore.getState().votes
    const expectedIds = new Set(restaurants.map((r) => r.id))
    const voteKeys = Object.keys(latestVotes)
    const voteKeysOk =
      voteKeys.length === restaurants.length && voteKeys.every((k) => expectedIds.has(k))
    if (!voteKeysOk) {
      setSwipeError('Something went wrong saving your swipes. Please try again.')
      useSessionStore.getState().clearVotes()
      setSwipeDeckKey((k) => k + 1)
      return
    }

    const result = await submitSwipes(id, memberId, latestVotes, session?.status === 'round_two' ? 2 : 1)

    if (result?.error) {
      setSwipeError(result.error.message || 'Could not save your picks. Try again.')
      return
    }

    setHasSubmitted(true)

    if (result?.data?.all_submitted && isHost) {
      setIsResolvingResults(true)
      try {
        const data = await fetchAndSetResults(id)
        if (data?.status === 'completed') {
          fetchSession(id)
        }
      } finally {
        setIsResolvingResults(false)
      }
    }
  }, [
    id,
    memberId,
    restaurants,
    submitSwipes,
    session?.status,
    isHost,
    fetchAndSetResults,
    fetchSession,
  ])

  const handleSeeResults = useCallback(async () => {
    if (!id) return
    setIsResolvingResults(true)
    try {
      const data = await fetchAndSetResults(id)
      if (data?.status === 'completed') {
        fetchSession(id)
      }
    } finally {
      setIsResolvingResults(false)
    }
  }, [id, fetchAndSetResults, fetchSession])

  const handleSkipMember = useCallback(async (mId: string) => {
    if (!id) return
    await skipMember(id, mId)
  }, [id, skipMember])

  const handleDone = useCallback(() => {
    navigate('/app')
  }, [navigate])

  if (loading || !session) {
    return (
      <div className="flex flex-1 flex-col">
        <LoadingOverlay visible={loading} title="Setting up your session" />
        <div className="h-14 bg-primary" />
        <div className="space-y-4 p-5">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    )
  }

  const statusLabels: Record<string, { title: string; subtitle: string }> = {
    waiting: { title: 'Waiting for everyone', subtitle: `Session #${session.invite_code}` },
    swiping: { title: 'Swiping', subtitle: `${restaurants.length} restaurants` },
    round_two: { title: 'Round 2', subtitle: 'Narrowing it down' },
    completed: { title: "It's a match!", subtitle: 'Everyone agreed' },
  }

  const { title, subtitle } = statusLabels[session.status] ?? statusLabels.waiting

  return (
    <div className="flex flex-1 flex-col">
      <LoadingOverlay
        visible={isResolvingResults || (session.status === 'completed' && resultsPending && !resultsData)}
        title="Crunching everyone’s picks"
        messages={[
          'Brewing...',
          'Cooking...',
          'Comparing swipes...',
          'Finding the best match...',
        ]}
      />

      <Header title={title} subtitle={subtitle} showBack />

      {session.status === 'waiting' && (
        <WaitingRoom
          session={session}
          members={members}
          onSkipMember={handleSkipMember}
          onStartSwiping={handleStartSwiping}
        />
      )}

      {(session.status === 'swiping' || session.status === 'round_two') && !hasSubmittedForRound && restaurants.length > 0 && (
        <>
          {swipeError && (
            <p className="mx-5 mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {swipeError}
            </p>
          )}
          <SwipeDeck
            key={swipeDeckKey}
            restaurants={restaurants}
            onVote={handleVote}
            onComplete={handleSwipeComplete}
          />
        </>
      )}

      {(session.status === 'swiping' || session.status === 'round_two') && hasSubmittedForRound && (
        <WaitingForOthers
          session={session}
          members={members}
          onSkipMember={handleSkipMember}
          onSeeResults={isHost ? handleSeeResults : undefined}
        />
      )}

      {session.status === 'completed' && (
        <>
          {resultsPending && !resultsData && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading results…</p>
            </div>
          )}
          {resultsIsError && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-sm text-muted-foreground">Could not load results.</p>
              <Button type="button" variant="outline" onClick={() => void refetchResults()}>
                Retry
              </Button>
            </div>
          )}
          {matchResult && (
            <ResultScreen
              matchType={matchResult.type}
              winners={matchResult.winners}
              onDone={handleDone}
            />
          )}
        </>
      )}
    </div>
  )
}
