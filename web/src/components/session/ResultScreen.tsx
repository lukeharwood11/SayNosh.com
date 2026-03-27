import { useState, type TouchEvent } from 'react'
import { MdCelebration, MdMap, MdArrowForward, MdStar, MdLocationOn } from 'react-icons/md'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ResultWinner {
  id: string
  name: string
  rating: number | null
  price_level: number | null
  image_url: string | null
  address: string | null
}

const FOOD_EMOJIS = ['🍕', '🍜', '🍣', '🌮', '🍔', '🥗', '🍝', '🍛', '🥘', '🍱']

function getEmoji(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return FOOD_EMOJIS[Math.abs(hash) % FOOD_EMOJIS.length]
}

interface ResultScreenProps {
  matchType: 'strong' | 'soft' | 'fallback'
  winners: ResultWinner[]
  onDone: () => void
}

export function ResultScreen({ matchType, winners, onDone }: ResultScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const winner = winners[Math.min(currentIndex, Math.max(0, winners.length - 1))]
  const hasMultiple = winners.length > 1

  const handleSwipeStart = (e: TouchEvent<HTMLDivElement>) => {
    ;(e.currentTarget as HTMLDivElement).dataset.touchStartX = String(e.touches[0]?.clientX ?? 0)
  }

  const handleSwipeEnd = (e: TouchEvent<HTMLDivElement>) => {
    const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchStartX ?? 0)
    const endX = e.changedTouches[0]?.clientX ?? startX
    const delta = endX - startX
    if (Math.abs(delta) < 40) return
    if (delta < 0) {
      setCurrentIndex((i) => Math.min(i + 1, winners.length - 1))
    } else {
      setCurrentIndex((i) => Math.max(i - 1, 0))
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-5 p-5 pt-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-nosh-yes/10">
        <MdCelebration className="h-8 w-8 text-nosh-yes" />
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-medium">
          {matchType === 'strong'
            ? "It's a match!"
            : matchType === 'soft'
              ? 'We found some options!'
              : 'Best we could do!'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {matchType === 'strong'
            ? 'Everyone agreed on this one'
            : matchType === 'soft'
              ? 'A few places passed the vibe check'
              : 'No perfect match, but this was top-rated'}
        </p>
      </div>

      {winner && (
        <Card className="w-full overflow-hidden" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
          <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-nosh-blush/50 to-primary/10">
            {winner.image_url ? (
              <img
                src={winner.image_url}
                alt={winner.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-7xl">{getEmoji(winner.name)}</span>
            )}
          </div>
          <CardContent className="p-5 text-center">
            <h3 className="text-xl font-medium">{winner.name}</h3>
            <div className="mt-2 flex items-center justify-center gap-3 text-sm text-muted-foreground">
              {winner.rating && (
                <span className="flex items-center gap-0.5">
                  <MdStar className="h-4 w-4 text-amber-500" />
                  {winner.rating.toFixed(1)}
                </span>
              )}
              {winner.price_level && (
                <span className="font-medium text-nosh-yes">
                  {'$'.repeat(winner.price_level)}
                </span>
              )}
            </div>
            {winner.address && (
              <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <MdLocationOn className="h-3.5 w-3.5 shrink-0" />
                <span>{winner.address}</span>
              </div>
            )}
            <Badge
              variant={matchType === 'strong' ? 'default' : matchType === 'soft' ? 'secondary' : 'outline'}
              className="mt-3"
            >
              {matchType === 'strong' ? 'Strong match' : matchType === 'soft' ? 'Soft match' : 'Best available'}
            </Badge>

            {hasMultiple && (
              <p className="mt-3 text-xs text-muted-foreground">
                Match {currentIndex + 1} of {winners.length}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {hasMultiple && (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <p>Swipe left/right to browse all matches</p>
          <div className="flex items-center gap-1.5">
            {winners.map((w, idx) => (
              <button
                key={w.id}
                type="button"
                aria-label={`Show match ${idx + 1}`}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${idx === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                onClick={() => setCurrentIndex(idx)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex w-full flex-col gap-3 pb-4">
        {winner?.address && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(winner.address!)}`,
                '_blank'
              )
            }}
          >
            <MdMap className="h-5 w-5" />
            Open in Maps
          </Button>
        )}

        <Button
          className="w-full gap-2"
          size="lg"
          onClick={onDone}
        >
          Let's go!
          <MdArrowForward className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
