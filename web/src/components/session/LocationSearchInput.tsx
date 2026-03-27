import { useCallback, useEffect, useRef, useState } from 'react'
import { MdLocationOn, MdMyLocation, MdClose } from 'react-icons/md'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { invokeAuthenticatedFunction } from '@/lib/supabase-functions'
import { cn } from '@/lib/utils'

export interface ResolvedLocation {
  lat: number
  lng: number
  city: string
  state: string
  label: string
}

interface Prediction {
  placeId: string
  mainText: string
  secondaryText: string
}

interface Props {
  onLocationChange: (location: ResolvedLocation | null) => void
  value?: ResolvedLocation | null
}

export function LocationSearchInput({ onLocationChange, value }: Props) {
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const resolved = value ?? null
  const inputDisplay = resolved?.label ?? query

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.trim().length < 2) {
      setPredictions([])
      return
    }

    const { data, error } = await invokeAuthenticatedFunction<{ predictions: Prediction[] }>(
      'place-autocomplete',
      { body: { input } },
    )

    if (error || !data?.predictions) {
      setPredictions([])
      return
    }

    setPredictions(data.predictions)
    setOpen(data.predictions.length > 0)
  }, [])

  const handleInputChange = (text: string) => {
    setQuery(text)

    if (resolved) {
      onLocationChange(null)
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (text.trim().length < 2) {
      setPredictions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      fetchPredictions(text)
    }, 300)
  }

  const selectPrediction = async (prediction: Prediction) => {
    setOpen(false)
    setQuery(`${prediction.mainText}, ${prediction.secondaryText}`)
    setLoading(true)

    const { data, error } = await invokeAuthenticatedFunction<ResolvedLocation>(
      'place-autocomplete',
      { body: { place_id: prediction.placeId } },
    )

    setLoading(false)

    if (error || !data) {
      setGeoError('Could not resolve that location')
      return
    }

    setQuery(data.label)
    setGeoError('')
    onLocationChange(data)
  }

  const handleMyLocation = async () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by your browser')
      return
    }

    setGeoLoading(true)
    setGeoError('')

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords

        const { data, error } = await invokeAuthenticatedFunction<ResolvedLocation>(
          'place-autocomplete',
          { body: { lat, lng } },
        )

        setGeoLoading(false)

        if (error || !data) {
          setGeoError('Could not determine your location')
          return
        }

        setQuery(data.label)
        setPredictions([])
        setOpen(false)
        onLocationChange(data)
      },
      (err) => {
        setGeoLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission denied')
        } else {
          setGeoError('Could not get your location')
        }
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  const clearLocation = () => {
    setQuery('')
    setPredictions([])
    setOpen(false)
    setGeoError('')
    onLocationChange(null)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MdLocationOn className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="City, state or ZIP code"
            value={inputDisplay}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (predictions.length > 0 && !resolved) setOpen(true)
            }}
            className={cn('pl-9 pr-9', resolved && 'border-primary')}
            autoComplete="off"
          />
          {(query || resolved) && (
            <button
              type="button"
              onClick={clearLocation}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear location"
            >
              <MdClose className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={handleMyLocation}
          disabled={geoLoading}
          title="Use my location"
        >
          {geoLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <MdMyLocation className="h-5 w-5" />
          )}
        </Button>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground">Resolving location…</p>
      )}
      {geoError && (
        <p className="text-xs text-destructive">{geoError}</p>
      )}

      {open && predictions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
          {predictions.map((p) => (
            <li key={p.placeId}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                onClick={() => selectPrediction(p)}
              >
                <MdLocationOn className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">{p.mainText}</span>
                  {p.secondaryText && (
                    <span className="text-muted-foreground"> {p.secondaryText}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
