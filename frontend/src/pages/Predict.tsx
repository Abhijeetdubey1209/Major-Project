import { useState } from 'react'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import type { RiskResult, TrackForecastModelMetadata, TrackForecastResult } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/States'
import { PathMap } from '@/components/map/PathMap'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/utils'

const LEVEL_COLOR: Record<RiskResult['risk_level'], string> = {
  Low: 'text-emerald-400',
  Moderate: 'text-accent',
  High: 'text-warn',
  Extreme: 'text-danger',
}

export function Predict() {
  const model = useAsync<TrackForecastModelMetadata>(() => api.trackForecastModel(), [])
  const [location, setLocation] = useState({ latitude: 15, longitude: 70 })
  const [form, setForm] = useState({
    storm_speed: '12',
    storm_direction: '315',
    wind_speed: '45',
    pressure: '995',
    sst: '28.5',
  })
  const [result, setResult] = useState<RiskResult | null>(null)
  const [forecast, setForecast] = useState<TrackForecastResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handlePick(lat: number, lon: number) {
    setLocation({ latitude: Math.round(lat * 100) / 100, longitude: Math.round(lon * 100) / 100 })
    setResult(null)
    setForecast(null)
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const [riskRes, forecastRes] = await Promise.all([
        api.predict({
          latitude: location.latitude,
          longitude: location.longitude,
          wind_speed: Number(form.wind_speed),
          pressure: Number(form.pressure),
          sst: Number(form.sst),
        }),
        api.trackForecast({
          latitude: location.latitude,
          longitude: location.longitude,
          storm_speed: Number(form.storm_speed),
          storm_direction: Number(form.storm_direction),
          wind_speed: Number(form.wind_speed),
          pressure: Number(form.pressure),
        }),
      ])
      setResult(riskRes)
      setForecast(forecastRes)
    } catch {
      setError('Could not compute estimate.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {model.data && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 py-4 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Sparkles size={16} className="text-accent" />
              Track Forecast Model
            </span>
            {model.data.available ? (
              <>
                <span className="text-text-dim">
                  Trained on {model.data.metrics_by_horizon?.['12']?.training_samples.toLocaleString()}{' '}
                  historical storm positions
                </span>
                <span className="text-text-dim">
                  Typical error at 12h:{' '}
                  <span className="text-text">{model.data.metrics_by_horizon?.['12']?.median_error_km} km</span>
                </span>
                <span className="text-text-dim">
                  at 24h: <span className="text-text">{model.data.metrics_by_horizon?.['24']?.median_error_km} km</span>
                </span>
                <span className="text-text-dim">
                  at 48h: <span className="text-text">{model.data.metrics_by_horizon?.['48']?.median_error_km} km</span>
                </span>
              </>
            ) : (
              <span className="text-text-dim">Not trained yet — run backend/scripts/train_track_forecast_model.py</span>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-text-dim">
            Click anywhere on the map (or drag the marker) to choose where the storm is right now,
            then set its current motion and conditions below.
          </p>
          <PathMap
            latitude={location.latitude}
            longitude={location.longitude}
            forecast={forecast?.available ? forecast.points ?? [] : []}
            onPick={handlePick}
          />
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-dim">
            <span>
              Selected: {location.latitude}°, {location.longitude}°
            </span>
            {forecast && !forecast.available && <span>{forecast.reason}</span>}
            {forecast?.available && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-sm border-t-2 border-dashed border-[#f59e0b]" />
                Predicted track (12h / 24h / 48h) — inner circle is the typical error at that
                step, outer dashed circle is how far off it usually is at most
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Storm Motion &amp; Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              label="Current Speed (knots)"
              hint="How fast the storm is currently moving forward (not its wind speed)."
              value={form.storm_speed}
              onChange={(v) => setForm((f) => ({ ...f, storm_speed: v }))}
            />
            <FormField
              label="Current Direction (compass degrees)"
              hint="Direction the storm is heading toward, 0=North, 90=East, 180=South, 270=West."
              value={form.storm_direction}
              onChange={(v) => setForm((f) => ({ ...f, storm_direction: v }))}
            />
            <FormField
              label="Wind Speed (knots)"
              hint="1 knot ≈ 1.15 mph. Tropical storm strength starts around 34 knots."
              value={form.wind_speed}
              onChange={(v) => setForm((f) => ({ ...f, wind_speed: v }))}
            />
            <FormField
              label="Air Pressure (hPa)"
              hint="Lower pressure usually means a stronger storm. Typical fair-weather pressure is around 1013 hPa."
              value={form.pressure}
              onChange={(v) => setForm((f) => ({ ...f, pressure: v }))}
            />
            <FormField
              label="Sea Surface Temperature (°C)"
              hint="Warmer water (above ~26.5°C) helps cyclones form and strengthen."
              value={form.sst}
              onChange={(v) => setForm((f) => ({ ...f, sst: v }))}
            />

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-md bg-accent py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'ANALYZING...' : 'ANALYZE CONDITIONS'}
            </button>

            <p className="pt-2 text-xs leading-relaxed text-text-dim">
              The severity score is a transparent rule-based estimate. The track forecast is a
              trained model evaluated on real historical storms it never saw — but this is an
              academic research tool, not an operational cyclone forecasting system, and must not
              be used for safety-critical decisions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Predicted Severity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <LoadingState label="Running risk analysis..." />}
            {error && <p className="text-sm text-danger">{error}</p>}
            {!loading && !result && !error && (
              <p className="text-sm text-text-dim">Pick a location and conditions, then click Analyze.</p>
            )}
            {result && (
              <div className="space-y-5">
                <div className="flex items-center gap-6">
                  <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-panel-2">
                    <span className={cn('text-3xl font-bold', LEVEL_COLOR[result.risk_level])}>
                      {Math.round(result.risk_score)}
                    </span>
                  </div>
                  <div>
                    <p className={cn('text-lg font-semibold', LEVEL_COLOR[result.risk_level])}>
                      {result.risk_level.toUpperCase()} SEVERITY
                    </p>
                    <p className="text-xs text-text-dim">Score out of 100</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {result.explanation.map((line) => (
                    <div key={line} className="flex items-start gap-2 text-sm text-text-dim">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-text-dim">How much each factor contributed to the score:</p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <FactorBar label="Sea Temp" value={result.factors.sst_score} />
                  <FactorBar label="Air Pressure" value={result.factors.pressure_score} />
                  <FactorBar label="Wind Speed" value={result.factors.wind_score} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-dim" title={hint}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      {hint && <span className="mt-1 block text-[11px] text-text-dim">{hint}</span>}
    </label>
  )
}

function FactorBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="mb-1 text-text-dim">{label}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
