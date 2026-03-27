import { useState, useRef, useCallback, useEffect } from 'react'
import { MdClose, MdFavorite, MdRemove } from 'react-icons/md'
import { RestaurantCard } from './RestaurantCard'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import type { Vote } from '@/stores/session-store'

type Restaurant = Database['public']['Tables']['restaurants']['Row']

interface SwipeDeckProps {
  restaurants: Restaurant[]
  onVote: (restaurantId: string, vote: Vote) => void
  onComplete: () => void
}

/** Ignore taps for a beat after mount so pointer-up from "Start swiping" cannot hit the deck (tap-through). */
const SWIPE_INTERACTION_DELAY_MS = 380

export function SwipeDeck({ restaurants, onVote, onComplete }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'down' | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [interactionReady, setInteractionReady] = useState(false)
  const startPos = useRef({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const voteAnimationRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setInteractionReady(true), SWIPE_INTERACTION_DELAY_MS)
    return () => {
      window.clearTimeout(t)
      if (voteAnimationRef.current) clearTimeout(voteAnimationRef.current)
    }
  }, [])

  const progress = restaurants.length > 0
    ? ((currentIndex) / restaurants.length) * 100
    : 0

  const handleVote = useCallback((vote: Vote) => {
    const restaurant = restaurants[currentIndex]
    if (!restaurant) return

    setExitDirection(vote === 'yes' ? 'right' : vote === 'no' ? 'left' : 'down')

    if (voteAnimationRef.current) clearTimeout(voteAnimationRef.current)
    voteAnimationRef.current = setTimeout(() => {
      voteAnimationRef.current = null
      onVote(restaurant.id, vote)
      setExitDirection(null)
      setDragOffset({ x: 0, y: 0 })

      if (currentIndex + 1 >= restaurants.length) {
        onComplete()
      } else {
        setCurrentIndex((i) => i + 1)
      }
    }, 250)
  }, [currentIndex, restaurants, onVote, onComplete])

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    startPos.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    setDragOffset({
      x: e.clientX - startPos.current.x,
      y: e.clientY - startPos.current.y,
    })
  }

  const handlePointerUp = () => {
    if (!isDragging) return
    setIsDragging(false)

    const threshold = 80
    if (dragOffset.x > threshold) {
      handleVote('yes')
    } else if (dragOffset.x < -threshold) {
      handleVote('no')
    } else if (dragOffset.y > threshold) {
      handleVote('neutral')
    } else {
      setDragOffset({ x: 0, y: 0 })
    }
  }

  if (currentIndex >= restaurants.length) return null

  const rotation = dragOffset.x * 0.1
  const exitTransform = exitDirection === 'left'
    ? 'translateX(-120%) rotate(-30deg)'
    : exitDirection === 'right'
      ? 'translateX(120%) rotate(30deg)'
      : exitDirection === 'down'
        ? 'translateY(120%)'
        : undefined

  const overlayColor = dragOffset.x > 40
    ? 'rgba(76, 175, 125, 0.15)'
    : dragOffset.x < -40
      ? 'rgba(232, 80, 58, 0.15)'
      : dragOffset.y > 40
        ? 'rgba(136, 135, 128, 0.15)'
        : 'transparent'

  const overlayLabel = dragOffset.x > 40
    ? 'YES'
    : dragOffset.x < -40
      ? 'NOPE'
      : dragOffset.y > 40
        ? 'MEH'
        : null

  const overlayLabelColor = dragOffset.x > 40
    ? 'text-nosh-yes'
    : dragOffset.x < -40
      ? 'text-primary'
      : 'text-nosh-meh'

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-5 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>{currentIndex + 1} of {restaurants.length}</span>
          <span>{restaurants.length - currentIndex} left</span>
        </div>
        <Progress value={progress} />
      </div>

      <div
        className={cn(
          'relative flex flex-1 flex-col',
          !interactionReady && 'pointer-events-none select-none',
        )}
      >
        <div className="relative flex flex-1 items-center justify-center px-5">
          {/* next card preview */}
          {currentIndex + 1 < restaurants.length && (
            <div className="absolute inset-x-5 scale-[0.95] opacity-50">
              <RestaurantCard restaurant={restaurants[currentIndex + 1]} />
            </div>
          )}

          {/* current card */}
          <div
            ref={cardRef}
            className="relative w-full touch-none select-none"
            style={{
              transform: exitTransform ?? `translate(${dragOffset.x}px, ${Math.max(0, dragOffset.y)}px) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.25s ease-out',
              zIndex: 10,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl transition-colors"
              style={{ backgroundColor: overlayColor }}
            >
              {overlayLabel && (
                <span className={`text-4xl font-black ${overlayLabelColor}`}>
                  {overlayLabel}
                </span>
              )}
            </div>
            <RestaurantCard restaurant={restaurants[currentIndex]} />
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 px-5 py-5">
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full border-2 border-primary text-primary hover:bg-primary/10"
            onClick={() => handleVote('no')}
          >
            <MdClose className="h-7 w-7" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full border-2 border-nosh-meh text-nosh-meh hover:bg-nosh-meh/10"
            onClick={() => handleVote('neutral')}
          >
            <MdRemove className="h-6 w-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full border-2 border-nosh-yes text-nosh-yes hover:bg-nosh-yes/10"
            onClick={() => handleVote('yes')}
          >
            <MdFavorite className="h-7 w-7" />
          </Button>
        </div>
      </div>

      <div className="pb-2 text-center text-xs text-muted-foreground">
        ← no · meh ↓ · yes →
      </div>
    </div>
  )
}
