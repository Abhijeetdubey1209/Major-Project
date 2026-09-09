import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Polyline, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Card } from '@/components/ui/Card'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { WindLegend } from '@/components/map/WindLegend'
import { windColor } from '@/lib/geo'

export function GlobalMap() {
  const [season, setSeason] = useState('')
  const [minWind, setMinWind] = useState('')
  const navigate = useNavigate()

  const { data, loading, error } = useAsync(
    () =>
      api.cycloneTracks({
        season: season ? Number(season) : undefined,
        min_wind: minWind ? Number(minWind) : undefined,
        limit: 200,
      }),
    [season, minWind],
  )

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-4 p-5">
        <Field label="Season">
          <input
            type="number"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="e.g. 2020"
            className="w-32 rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Min. Wind Speed (knots)">
          <input
            type="number"
            value={minWind}
            onChange={(e) => setMinWind(e.target.value)}
            placeholder="e.g. 64"
            className="w-32 rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        {(season || minWind) && (
          <button
            type="button"
            onClick={() => {
              setSeason('')
              setMinWind('')
            }}
            className="text-xs text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
        <p className="ml-auto text-xs text-text-dim">
          Showing up to 200 strongest matching cyclones. Click a track to view details.
        </p>
      </Card>

      <Card className="overflow-hidden">
        {loading && <LoadingState label="Loading cyclone tracks..." />}
        {error && <ErrorState label="Could not load cyclone tracks." />}
        {data && (
          <div className="map-dark relative" style={{ height: 600 }}>
            <MapContainer center={[15, 75]} zoom={4} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {data.map((track) => (
                <Polyline
                  key={track.sid}
                  positions={track.points as [number, number][]}
                  pathOptions={{ color: windColor(track.max_wind), weight: 2, opacity: 0.7 }}
                  eventHandlers={{ click: () => navigate(`/cyclones/${track.sid}`) }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-medium">{track.name ?? 'Unnamed storm'}</p>
                      <p>
                        Season {track.season} &middot; peak wind {track.max_wind ?? '—'} knots
                      </p>
                    </div>
                  </Popup>
                </Polyline>
              ))}
              {data.map((track) => (
                <CircleMarker
                  key={`${track.sid}-start`}
                  center={track.points[0] as [number, number]}
                  radius={3}
                  pathOptions={{ color: '#34d399', fillColor: '#34d399', fillOpacity: 0.9 }}
                />
              ))}
              {data.map((track) => {
                const last = track.points[track.points.length - 1]
                return (
                  <CircleMarker
                    key={`${track.sid}-end`}
                    center={last as [number, number]}
                    radius={3}
                    pathOptions={{ color: '#f87171', fillColor: '#f87171', fillOpacity: 0.9 }}
                  />
                )
              })}
            </MapContainer>
            <WindLegend />
          </div>
        )}
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-dim">{label}</span>
      {children}
    </label>
  )
}
