import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MdGroups, MdHistory, MdLocationOn, MdSearch, MdStar } from 'react-icons/md'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { fetchSessionHistory, type SessionHistoryItem } from '@/lib/fetch-session-history'
import { supabase } from '@/lib/supabase'

export function HistoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sessionHistory', user?.id],
    queryFn: () => fetchSessionHistory(supabase),
    enabled: Boolean(user),
    staleTime: 0,
  })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  const totalParticipants = useMemo(() => {
    return items.reduce((max, item) => Math.max(max, item.participants.length), 0)
  }, [items])

  const activeCount = useMemo(() => {
    return items.filter((item) => item.status !== 'completed').length
  }, [items])

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return items.filter((item) => {
      if (filter === 'active' && item.status === 'completed') return false
      if (filter === 'completed' && item.status !== 'completed') return false

      if (!normalizedSearch) return true

      return [
        item.invite_code,
        item.winner?.name ?? '',
        item.participants.join(' '),
        item.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [items, filter, search])

  const groupedItems = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const groups: Record<'Today' | 'This week' | 'Older', SessionHistoryItem[]> = {
      Today: [],
      'This week': [],
      Older: [],
    }

    for (const item of visibleItems) {
      const createdAt = new Date(item.created_at)
      if (createdAt >= today) {
        groups.Today.push(item)
      } else if (createdAt >= weekAgo) {
        groups['This week'].push(item)
      } else {
        groups.Older.push(item)
      }
    }

    return (Object.entries(groups) as Array<[keyof typeof groups, SessionHistoryItem[]]>).filter(([, value]) => value.length > 0)
  }, [visibleItems])

  return (
    <div className="flex flex-1 flex-col">
      <Header
        title="History"
        subtitle={`${items.length} session${items.length === 1 ? '' : 's'}${items.length ? ` • ${activeCount} active` : ''}${items.length ? ` • up to ${totalParticipants} people` : ''}`}
      />

      <div className="flex-1 p-4">
        <div className="mb-4 space-y-3">
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by restaurant, invite code, or person"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filter === 'active' ? 'default' : 'outline'}
              onClick={() => setFilter('active')}
            >
              Active
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filter === 'completed' ? 'default' : 'outline'}
              onClick={() => setFilter('completed')}
            >
              Completed
            </Button>
          </div>
        </div>

        {Boolean(user) && isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="space-y-3 p-4">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MdHistory className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 font-medium text-muted-foreground">
              {items.length === 0 ? 'No sessions yet' : 'No sessions match your filters'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              {items.length === 0
                ? 'Sessions you create or join will show up here'
                : 'Try adjusting your search or filter'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedItems.map(([groupLabel, groupSessions]) => (
              <section key={groupLabel} className="space-y-3">
                <h2 className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {groupLabel}
                </h2>
                <div className="space-y-3">
                  {groupSessions.map((item) => {
                    const isActive = item.status !== 'completed'

                    return (
                      <Card
                        key={item.id}
                        className="cursor-pointer border-2 border-transparent transition-all hover:border-primary/20 hover:shadow-md active:scale-[0.98]"
                        onClick={() => navigate(`/session/${item.id}`)}
                      >
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">
                                {isActive
                                  ? 'Session in progress'
                                  : item.winner?.name ?? 'Session result unavailable'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(item.created_at).toLocaleDateString()} • #{item.invite_code}
                              </p>
                            </div>
                            <Badge variant={isActive ? 'success' : 'secondary'}>
                              {isActive ? 'Resume' : 'Completed'}
                            </Badge>
                          </div>

                          {!isActive && item.winner?.address && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MdLocationOn className="h-3.5 w-3.5 shrink-0" />
                              <span>{item.winner.address}</span>
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {!isActive && item.winner?.rating != null && (
                              <span className="flex items-center gap-1">
                                <MdStar className="h-4 w-4 text-amber-500" />
                                {item.winner.rating.toFixed(1)}
                              </span>
                            )}

                            <span className="flex items-center gap-1">
                              <MdGroups className="h-4 w-4" />
                              {item.participants.length} people
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {item.participants.length > 0
                              ? `Involved: ${item.participants.join(', ')}`
                              : 'Participants unavailable'}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
