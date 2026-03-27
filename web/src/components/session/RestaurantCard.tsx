import { MdStar, MdLocationOn } from 'react-icons/md'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Database } from '@/types/database'

type Restaurant = Database['public']['Tables']['restaurants']['Row']

const FOOD_EMOJIS = ['🍕', '🍜', '🍣', '🌮', '🍔', '🥗', '🍝', '🍛', '🥘', '🍱']

function getEmoji(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return FOOD_EMOJIS[Math.abs(hash) % FOOD_EMOJIS.length]
}

function priceLabel(level: number | null) {
  if (!level) return ''
  return '$'.repeat(level)
}

interface RestaurantCardProps {
  restaurant: Restaurant
  style?: React.CSSProperties
  className?: string
}

function isCustomSpot(restaurant: Restaurant) {
  return restaurant.external_id.startsWith('custom:')
}

export function RestaurantCard({ restaurant, style, className }: RestaurantCardProps) {
  const custom = isCustomSpot(restaurant)

  return (
    <Card
      className={`overflow-hidden ${className ?? ''}`}
      style={style}
    >
      <div className="relative flex h-48 items-center justify-center bg-gradient-to-br from-nosh-blush/50 to-primary/10">
        {restaurant.image_url ? (
          <img
            src={restaurant.image_url}
            alt={restaurant.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-6xl">{getEmoji(restaurant.name)}</span>
        )}
      </div>

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-medium">{restaurant.name}</h3>
          {custom && (
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              Custom
            </Badge>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
          {restaurant.rating && (
            <span className="flex items-center gap-0.5">
              <MdStar className="h-4 w-4 text-amber-500" />
              {restaurant.rating.toFixed(1)}
            </span>
          )}
          {restaurant.price_level && (
            <span className="text-nosh-yes font-medium">{priceLabel(restaurant.price_level)}</span>
          )}
        </div>

        {restaurant.address && (
          <div className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
            <MdLocationOn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{restaurant.address}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
