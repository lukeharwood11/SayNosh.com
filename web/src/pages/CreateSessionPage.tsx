import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdLocationOn, MdTune, MdArrowForward, MdAdd, MdClose, MdAttachMoney, MdAccessTime } from 'react-icons/md'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { useSession } from '@/hooks/use-session'
import { readFunctionsHttpErrorBody } from '@/lib/supabase-functions'
import {
  LocationSearchInput,
  type ResolvedLocation,
} from '@/components/session/LocationSearchInput'

const RADIUS_OPTIONS = [
  { label: '0.5 mi', value: 800 },
  { label: '1 mi', value: 1600 },
  { label: '2 mi', value: 3200 },
  { label: '5 mi', value: 8000 },
  { label: '10 mi', value: 16000 },
  { label: '15 mi', value: 24000 },
  { label: '25 mi', value: 40000 },
]

const MEAL_TYPE_OPTIONS = [
  { label: 'Dinner / Lunch', value: 'dinner' },
  { label: 'Quick Bite', value: 'quick' },
  { label: 'Coffee / Drinks', value: 'coffee' },
  { label: 'Anything', value: 'any' },
] as const

type MealType = typeof MEAL_TYPE_OPTIONS[number]['value']

const CUISINE_OPTIONS_BY_MEAL_TYPE: Record<MealType, string[]> = {
  dinner: [
    'Any', 'American', 'Italian', 'Japanese', 'Mexican', 'Chinese',
    'Indian', 'Thai', 'Korean', 'Vietnamese', 'Mediterranean',
    'Seafood', 'Vegetarian',
  ],
  quick: ['Any', 'Fast Food', 'Pizza', 'American', 'Mexican'],
  coffee: [],
  any: [
    'Any', 'Fast Food', 'Coffee', 'Bakery', 'American', 'Italian',
    'Japanese', 'Mexican', 'Chinese', 'Indian', 'Thai', 'Korean',
    'Vietnamese', 'Mediterranean', 'Pizza', 'Seafood', 'Vegetarian',
  ],
}

const PRICE_OPTIONS = [
  { label: '$', value: 1 },
  { label: '$$', value: 2 },
  { label: '$$$', value: 3 },
  { label: '$$$$', value: 4 },
]

export function CreateSessionPage() {
  const navigate = useNavigate()
  const { createSession } = useSession()

  const [location, setLocation] = useState<ResolvedLocation | null>(null)
  const [radius, setRadius] = useState(1600)
  const [mealType, setMealType] = useState<MealType>('dinner')
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(['Any'])
  const [selectedPrices, setSelectedPrices] = useState<number[]>([1, 2, 3, 4])
  const [openNow, setOpenNow] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [customSpots, setCustomSpots] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')

  const locationReady = location !== null
  const cuisineOptions = CUISINE_OPTIONS_BY_MEAL_TYPE[mealType]

  const addCustomSpot = () => {
    const name = customInput.trim().slice(0, 120)
    if (!name) return
    const key = name.toLowerCase()
    setCustomSpots((prev) => {
      if (prev.some((p) => p.toLowerCase() === key)) return prev
      if (prev.length >= 20) return prev
      return [...prev, name]
    })
    setCustomInput('')
  }

  const removeCustomSpot = (name: string) => {
    setCustomSpots((prev) => prev.filter((p) => p !== name))
  }

  const handleMealTypeChange = (type: MealType) => {
    setMealType(type)
    setSelectedCuisines(['Any'])
  }

  const toggleCuisine = (cuisine: string) => {
    if (cuisine === 'Any') {
      setSelectedCuisines(['Any'])
      return
    }
    setSelectedCuisines((prev) => {
      const without = prev.filter((c) => c !== 'Any')
      if (without.includes(cuisine)) {
        const result = without.filter((c) => c !== cuisine)
        return result.length === 0 ? ['Any'] : result
      }
      return [...without, cuisine]
    })
  }

  const togglePrice = (value: number) => {
    setSelectedPrices((prev) => {
      if (prev.includes(value)) {
        const result = prev.filter((v) => v !== value)
        return result.length === 0 ? [1, 2, 3, 4] : result
      }
      const next = [...prev, value].sort()
      return next.length === 4 ? [1, 2, 3, 4] : next
    })
  }

  const handleCreate = async () => {
    if (!location) {
      setError('Search for a location or use "My location"')
      return
    }

    setCreating(true)
    setError('')

    try {
      const allPricesSelected = selectedPrices.length === 4
      const payload = {
        city: location.city,
        state: location.state,
        lat: location.lat,
        lng: location.lng,
        radius,
        meal_type: mealType,
        cuisines: selectedCuisines.includes('Any') ? undefined : selectedCuisines,
        price_levels: allPricesSelected ? undefined : selectedPrices,
        open_now: openNow || undefined,
        custom_options: customSpots.length > 0 ? customSpots : undefined,
      }

      const { data, error: err } = await createSession(payload)

      if (err) {
        const errBody = await readFunctionsHttpErrorBody(err)
        const serverMsg =
          (data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : '') ||
          (errBody?.error != null ? String(errBody.error) : '')
        setError(serverMsg || err.message || 'Failed to create session')
        return
      }

      const sessionId = data?.session_id ?? ''
      if (!sessionId) {
        setError('Invalid response from server')
        return
      }

      navigate(`/session/${sessionId}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <LoadingOverlay
        visible={creating}
        title="Starting your session"
        messages={[
          'Brewing...',
          'Cooking...',
          'Picking great nearby spots...',
          'Setting the table...',
        ]}
      />

      <Header title="New Session" subtitle="Set your preferences" showBack />

      <div className="flex flex-1 flex-col gap-5 p-5">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <MdLocationOn className="h-4 w-4 text-nosh-yes" />
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your area
              </label>
            </div>
            <LocationSearchInput onLocationChange={setLocation} value={location} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Search radius
            </label>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRadius(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    radius === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <MdTune className="h-4 w-4 text-muted-foreground" />
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                What are you in the mood for?
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleMealTypeChange(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    mealType === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MdAttachMoney className="h-4 w-4 text-muted-foreground" />
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Price range
                </label>
              </div>
              <div className="flex items-center gap-2">
                <MdAccessTime className="h-4 w-4 text-muted-foreground" />
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Open now
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={openNow}
                  onClick={() => setOpenNow((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    openNow ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      openNow ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {PRICE_OPTIONS.map((opt) => {
                const active = selectedPrices.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => togglePrice(opt.value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Custom spots
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              Add options Google might not list — a food truck, potluck, or anywhere with a name you choose.
            </p>
            <div className="flex gap-2">
              <Input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="e.g. Mom's lasagna, Tacos El Rey truck"
                className="flex-1"
                maxLength={120}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomSpot()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={addCustomSpot}
                disabled={!customInput.trim() || customSpots.length >= 20}
                title="Add spot"
              >
                <MdAdd className="h-5 w-5" />
              </Button>
            </div>
            {customSpots.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {customSpots.map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm"
                  >
                    <span className="max-w-[200px] truncate">{name}</span>
                    <button
                      type="button"
                      onClick={() => removeCustomSpot(name)}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                      aria-label={`Remove ${name}`}
                    >
                      <MdClose className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {cuisineOptions.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <MdTune className="h-4 w-4 text-muted-foreground" />
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Cuisine
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {cuisineOptions.map((cuisine) => (
                  <button
                    key={cuisine}
                    type="button"
                    onClick={() => toggleCuisine(cuisine)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      selectedCuisines.includes(cuisine)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {cuisine}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-auto pb-4">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handleCreate}
            disabled={creating || !locationReady}
          >
            {creating ? 'Creating...' : 'Start session'}
            <MdArrowForward className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
