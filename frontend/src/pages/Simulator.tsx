import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Search, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import type { CycloneDetail, CycloneSummary, TrackForecastModelMetadata, TrackForecastResult, TrackPoint } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { SimulatorMap, type ActualFuturePoint } from '@/components/map/SimulatorMap'
import { haversineKm } from '@/lib/geo'
import { cn } from '@/lib/utils'

const HORIZONS = [12, 24, 48]
const SPEED_OPTIONS = [1, 2, 4]

function findActualFuture(track: TrackPoint[], fromIndex: number, hoursAhead: number): ActualFuturePoint | null {
  const fromTime = new Date(track[fromIndex].timestamp).getTime()
  const targetTime = fromTime + hoursAhead * 3_600_000
  const tolerance = hoursAhead * 0.25 * 3_600_000

  let best: TrackPoint | null = null
  let bestDiff = Infinity
  for (let i = fromIndex + 1; i < track.length; i++) {
    const diff = Math.abs(new Date(track[i].timestamp).getTime() - targetTime)
    if (diff < bestDiff) {
      bestDiff = diff
      best = track[i]
    }
  }
  if (best && bestDiff <= tolerance) {
    return { hours_ahead: hoursAhead, latitude: best.latitude, longitude: best.longitude, timestamp: best.timestamp }
  }
  return null
}

export function Simulator() {
  const model = useAsync<TrackForecastModelMetadata>(() => api.trackForecastModel(), [])

  const [cyclone, setCyclone] = useState<CycloneDetail | null>(null)
  const [loadingCyclone, setLoadingCyclone] = useState(true)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CycloneSummary[]>([])
  const [showResults, setShowResults] = useState(false)

  const [forecast, setForecast] = useState<TrackForecastResult | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load a strong default storm on first mount.
  useEffect(() => {
    api
      .strongestCyclones(1)
      .then((top) => (top[0] ? api.getCyclone(top[0].sid) : null))
      .then((detail) => {
        if (detail) setCyclone(detail)
      })
      .finally(() => setLoadingCyclone(false))
  }, [])

  // Playback loop.
  useEffect(() => {
    if (!playing || !cyclone) return
    intervalRef.current = setInterval(() => {
      setIndex((i) => {
        if (i >= cyclone.track.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 700 / speed)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [playing, speed, cyclone])

  // Recompute the model's forecast whenever the scrub position or storm changes.
  useEffect(() => {
    if (!cyclone) return
    const current = cyclone.track[index]
    if (current.storm_speed == null || current.storm_direction == null || current.wind_speed == null) {
      setForecast({ available: false, reason: "This historical record doesn't have speed/direction data at this point." })
      return
    }
    const prev = index > 0 ? cyclone.track[index - 1] : null
    setForecastLoading(true)
    api
      .trackForecast({
        latitude: current.latitude,
        longitude: current.longitude,
        storm_speed: current.storm_speed,
        storm_direction: current.storm_direction,
        wind_speed: current.wind_speed,
        pressure: current.pressure ?? undefined,
        prev_storm_speed: prev?.storm_speed ?? undefined,
        prev_storm_direction: prev?.storm_direction ?? undefined,
      })
      .then(setForecast)
      .finally(() => setForecastLoading(false))
  }, [cyclone, index])

  async function runSearch(q: string) {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      return
    }
    const res = await api.listCyclones({ search: q, limit: 8 })
    setResults(res.items)
    setShowResults(true)
  }

  async function selectCyclone(sid: string) {
    setPlaying(false)
    setShowResults(false)
    setQuery('')
    const detail = await api.getCyclone(sid)
    setCyclone(detail)
    setIndex(0)
  }

  if (loadingCyclone) return <LoadingState label="Loading a cyclone to simulate..." />
  if (!cyclone) return <ErrorState label="Could not load any cyclone to simulate." />

  const current = cyclone.track[index]
  const actualFuturePoints = HORIZONS.map((h) => findActualFuture(cyclone.track, index, h)).filter(
    (p): p is ActualFuturePoint => p !== null,
  )

  return (
    <div className="space-y-6">
      {model.data && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 py-4 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Sparkles size={16} className="text-accent" />
              Track Forecast Model
            </span>
            <span className="text-text-dim">
              This replays a real historical storm and asks the trained model to forecast each next
              step, using only what was known at that moment — the rest of the track is real history,
              not made up.
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="relative">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-dim">Simulating</p>
            <h2 className="text-2xl font-semibold">{cyclone.name ?? 'Unnamed storm'}</h2>
            <p className="text-sm text-text-dim">
              {cyclone.sid} &middot; Season {cyclone.season} &middot; Peak {cyclone.max_wind ?? '—'} kt
            </p>
          </div>

          <div className="relative w-64">
            <div className="flex items-center rounded-md border border-border bg-panel-2 px-2">
              <Search size={14} className="text-text-dim" />
              <input
                value={query}
                onChange={(e) => runSearch(e.target.value)}
                onFocus={() => setShowResults(true)}
                placeholder="Search a different cyclone..."
                className="w-full bg-transparent px-2 py-1.5 text-sm outline-none"
              />
            </div>
            {showResults && results.length > 0 && (
              <div className="absolute right-0 z-[1100] mt-1 w-full rounded-md border border-border bg-panel shadow-lg">
                {results.map((r) => (
                  <button
                    key={r.sid}
                    type="button"
                    onClick={() => selectCyclone(r.sid)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-panel-2"
                  >
                    <span className="font-medium">{r.name ?? 'Unnamed storm'}</span>{' '}
                    <span className="text-text-dim">
                      {r.season} &middot; {r.max_wind ?? '—'} kt
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-bg hover:opacity-90"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setIndex(0)
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-dim hover:bg-panel-2"
          >
            <RotateCcw size={14} />
          </button>
          <input
            type="range"
            min={0}
            max={cyclone.track.length - 1}
            value={index}
            onChange={(e) => {
              setPlaying(false)
              setIndex(Number(e.target.value))
            }}
            className="flex-1 accent-accent"
          />
          <div className="flex gap-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs',
                  speed === s ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim hover:bg-panel-2',
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-text-dim">
          Step {index + 1} of {cyclone.track.length} &middot; {new Date(current.timestamp).toUTCString()}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Track Map</CardTitle>
          </CardHeader>
          <CardContent>
            <SimulatorMap
              key={cyclone.sid}
              track={cyclone.track}
              currentIndex={index}
              forecastPoints={forecast?.available ? forecast.points ?? [] : []}
              actualFuturePoints={actualFuturePoints}
            />
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-dim">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-sm border-t-2 border-dashed border-[#f59e0b]" />
                Model's prediction
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full border-2 border-text bg-bg" />
                What actually happened
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-sm border-t border-dotted border-text-dim" />
                Rest of the real historical track
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Conditions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Wind Speed" value={`${current.wind_speed ?? '—'} kt`} />
              <Info label="Pressure" value={`${current.pressure ?? '—'} hPa`} />
              <Info label="Storm Speed" value={`${current.storm_speed ?? '—'} kt`} />
              <Info label="Direction" value={`${current.storm_direction ?? '—'}°`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Predicted vs. Actual</CardTitle>
            </CardHeader>
            <CardContent>
              {forecastLoading && <LoadingState label="Forecasting..." />}
              {!forecastLoading && forecast && !forecast.available && (
                <p className="text-sm text-text-dim">{forecast.reason}</p>
              )}
              {!forecastLoading && forecast?.available && (
                <div className="space-y-3">
                  {(forecast.points ?? []).map((p) => {
                    const actual = actualFuturePoints.find((a) => a.hours_ahead === p.hours_ahead)
                    const errorKm = actual
                      ? haversineKm(p.latitude, p.longitude, actual.latitude, actual.longitude)
                      : null
                    return (
                      <div key={p.hours_ahead} className="rounded-md border border-border bg-panel-2 p-3 text-sm">
                        <p className="mb-1 font-medium">+{p.hours_ahead} hours</p>
                        {actual ? (
                          <>
                            <p className="text-text-dim">
                              Prediction was off by{' '}
                              <span className="text-text">{errorKm!.toFixed(0)} km</span> from what
                              actually happened
                            </p>
                            <p className="text-text-dim">Model's typical error here: ~{p.expected_error_km} km</p>
                          </>
                        ) : (
                          <p className="text-text-dim">
                            Storm's real record ends before this point, so there's nothing to compare
                            against yet.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-panel-2 p-3">
      <p className="text-xs text-text-dim">{label}</p>
      <p className="text-base font-medium">{value}</p>
    </div>
  )
}
