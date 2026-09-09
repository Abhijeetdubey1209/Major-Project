import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackForecastPoint } from '@/types'

const PICKER_ICON = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#22d3ee;border:2px solid #07111f;box-shadow:0 0 0 2px #22d3ee66;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function PathMap({
  latitude,
  longitude,
  forecast,
  onPick,
  height = 360,
}: {
  latitude: number
  longitude: number
  forecast: TrackForecastPoint[]
  onPick: (lat: number, lon: number) => void
  height?: number
}) {
  const pathPositions: [number, number][] = [
    [latitude, longitude],
    ...forecast.map((p): [number, number] => [p.latitude, p.longitude]),
  ]

  return (
    <div className="map-dark overflow-hidden rounded-lg border border-border" style={{ height }}>
      <MapContainer center={[latitude, longitude]} zoom={5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <ClickHandler onPick={onPick} />

        <Marker
          position={[latitude, longitude]}
          icon={PICKER_ICON}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker
              const pos = marker.getLatLng()
              onPick(pos.lat, pos.lng)
            },
          }}
        >
          <Popup>Click or drag to change location</Popup>
        </Marker>

        {forecast.length > 0 && (
          <Polyline positions={pathPositions} pathOptions={{ color: '#f59e0b', weight: 3, dashArray: '6 6' }} />
        )}

        {forecast.map((p) => (
          <div key={p.hours_ahead}>
            {p.p90_error_km != null && (
              <Circle
                center={[p.latitude, p.longitude]}
                radius={p.p90_error_km * 1000}
                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.03, weight: 1, dashArray: '3 5' }}
              />
            )}
            {p.expected_error_km != null && (
              <Circle
                center={[p.latitude, p.longitude]}
                radius={p.expected_error_km * 1000}
                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.1, weight: 1 }}
              />
            )}
            <CircleMarker
              center={[p.latitude, p.longitude]}
              radius={5}
              pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.9 }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-medium">+{p.hours_ahead} hours</p>
                  <p>
                    Typically within ~{p.expected_error_km} km of this point (usually within ~
                    {p.p90_error_km} km)
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          </div>
        ))}
      </MapContainer>
    </div>
  )
}
