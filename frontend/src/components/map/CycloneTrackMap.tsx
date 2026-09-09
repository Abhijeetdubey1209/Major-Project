import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackPoint } from '@/types'
import { WindLegend } from './WindLegend'
import { windColor } from '@/lib/geo'

export function CycloneTrackMap({ track, height = 420 }: { track: TrackPoint[]; height?: number }) {
  if (track.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-panel-2 text-sm text-text-dim"
        style={{ height }}
      >
        No track points to display.
      </div>
    )
  }

  const positions: [number, number][] = track.map((p) => [p.latitude, p.longitude])
  const center = positions[Math.floor(positions.length / 2)]

  return (
    <div className="map-dark relative overflow-hidden rounded-lg border border-border" style={{ height }}>
      <MapContainer center={center} zoom={4} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <Polyline positions={positions} pathOptions={{ color: '#22d3ee', weight: 2, opacity: 0.6 }} />
        {track.map((p, i) => {
          const isStart = i === 0
          const isEnd = i === track.length - 1
          return (
            <CircleMarker
              key={`${p.timestamp}-${i}`}
              center={[p.latitude, p.longitude]}
              radius={isStart || isEnd ? 6 : 3.5}
              pathOptions={{
                color: isStart ? '#34d399' : isEnd ? '#f87171' : windColor(p.wind_speed),
                fillColor: isStart ? '#34d399' : isEnd ? '#f87171' : windColor(p.wind_speed),
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-medium">{new Date(p.timestamp).toUTCString()}</p>
                  <p>Location: {p.latitude.toFixed(2)}°, {p.longitude.toFixed(2)}°</p>
                  <p>Wind Speed: {p.wind_speed ?? 'N/A'} knots</p>
                  <p>Air Pressure: {p.pressure ?? 'N/A'} hPa</p>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
      <WindLegend />
    </div>
  )
}
