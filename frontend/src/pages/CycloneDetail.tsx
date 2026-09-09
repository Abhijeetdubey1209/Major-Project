import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Droplets, Gauge, MapPin, Wind } from 'lucide-react'
import { api } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { Badge, windSpeedVariant } from '@/components/ui/Badge'
import { CycloneTrackMap } from '@/components/map/CycloneTrackMap'

export function CycloneDetail() {
  const { sid = '' } = useParams()
  const { data: cyclone, loading, error } = useAsync(() => api.getCyclone(sid), [sid])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const era5 = useAsync(async () => {
    if (!cyclone || selectedIndex == null) return null
    const point = cyclone.track[selectedIndex]
    return api.era5Environment(point.latitude, point.longitude, point.timestamp)
  }, [cyclone, selectedIndex])

  const chartData = useMemo(
    () =>
      cyclone?.track.map((p) => ({
        time: new Date(p.timestamp).toISOString().slice(0, 10),
        wind: p.wind_speed,
        pressure: p.pressure,
      })) ?? [],
    [cyclone],
  )

  if (loading) return <LoadingState label="Loading cyclone track..." />
  if (error || !cyclone) return <ErrorState label="Cyclone not found." />

  const selectedPoint = selectedIndex != null ? cyclone.track[selectedIndex] : null

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{cyclone.name ?? 'Unnamed storm'}</h2>
            <p className="text-sm text-text-dim">
              <span title="Storm ID">{cyclone.sid}</span> &middot; Season {cyclone.season} &middot; {cyclone.basin}
              {cyclone.subbasin ? ` / ${cyclone.subbasin}` : ''}
            </p>
          </div>
          <Badge variant={windSpeedVariant(cyclone.max_wind)} className="text-sm">
            Peak {cyclone.max_wind ?? '—'} knots
          </Badge>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Peak Wind Speed" value={`${cyclone.max_wind ?? '—'} kt`} icon={Wind} />
          <StatCard label="Lowest Air Pressure" value={`${cyclone.min_pressure ?? '—'} hPa`} icon={Gauge} />
          <StatCard label="Records Tracked" value={String(cyclone.track_points_count)} icon={MapPin} />
          <StatCard label="Distance Traveled" value={`${Math.round(cyclone.track_length_km ?? 0)} km`} icon={Droplets} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Track Map (click a point for details)</CardTitle>
          </CardHeader>
          <CardContent>
            <CycloneTrackMap track={cyclone.track} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weather &amp; Ocean Conditions at That Time</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="mb-2 block text-xs text-text-dim">Pick a date/time along the storm's path</label>
            <select
              className="mb-4 w-full rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none"
              value={selectedIndex ?? ''}
              onChange={(e) => setSelectedIndex(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Select timestamp...</option>
              {cyclone.track.map((p, i) => (
                <option key={p.timestamp} value={i}>
                  {new Date(p.timestamp).toUTCString()}
                </option>
              ))}
            </select>

            {!selectedPoint && <p className="text-sm text-text-dim">Pick a date/time above to see conditions.</p>}
            {selectedPoint && era5.loading && <LoadingState label="Retrieving weather data..." />}
            {selectedPoint && era5.data && !era5.data.available && (
              <p className="rounded-md border border-border bg-panel-2 p-3 text-sm text-text-dim">
                {era5.data.reason ?? 'Weather data is unavailable for this record.'}
              </p>
            )}
            {selectedPoint && era5.data?.available && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <EraStat label="Wind Speed" value={`${era5.data.wind_speed} m/s`} hint="Meters per second" />
                <EraStat label="Wind Direction" value={`${era5.data.wind_direction}°`} hint="Direction the wind is blowing from" />
                <EraStat label="Air Pressure" value={`${era5.data.pressure_hpa} hPa`} />
                <EraStat label="Sea Surface Temp" value={`${era5.data.sst_celsius} °C`} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wind Speed Over Time</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2f47" />
              <XAxis dataKey="time" stroke="#8ea3bd" fontSize={10} minTickGap={40} />
              <YAxis stroke="#8ea3bd" fontSize={11} />
              <Tooltip contentStyle={{ background: '#101d30', border: '1px solid #1f2f47', borderRadius: 8 }} />
              <Line type="monotone" dataKey="wind" stroke="#22d3ee" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pressure Over Time</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2f47" />
              <XAxis dataKey="time" stroke="#8ea3bd" fontSize={10} minTickGap={40} />
              <YAxis stroke="#8ea3bd" fontSize={11} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: '#101d30', border: '1px solid #1f2f47', borderRadius: 8 }} />
              <Line type="monotone" dataKey="pressure" stroke="#f59e0b" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

function EraStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-panel-2 p-3" title={hint}>
      <p className="text-xs text-text-dim">{label}</p>
      <p className="text-base font-medium">{value}</p>
    </div>
  )
}
