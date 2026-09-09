import { CircleMarker, Circle, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackForecastPoint, TrackPoint } from '@/types'
import { windColor } from '@/lib/geo'
import { WindLegend } from './WindLegend'

export interface ActualFuturePoint {
  hours_ahead: number
  latitude: number
  longitude: number
  timestamp: string
}

export function SimulatorMap({
  track,
  currentIndex,
  forecastPoints,
  actualFuturePoints,
  height = 460,
}: {
  track: TrackPoint[]
  currentIndex: number
  forecastPoints: TrackForecastPoint[]
  actualFuturePoints: ActualFuturePoint[]
  height?: number
}) {
  const current = track[currentIndex]
  const pastTrack = track.slice(0, currentIndex + 1)
  const futureTrack = track.slice(currentIndex)

  const pastPositions: [number, number][] = pastTrack.map((p) => [p.latitude, p.longitude])
  const futurePositions: [number, number][] = futureTrack.map((p) => [p.latitude, p.longitude])

  const predictedPositions: [number, number][] = [
    [current.latitude, current.longitude],
    ...forecastPoints.map((p): [number, number] => [p.latitude, p.longitude]),
  ]
  const actualComparisonPositions: [number, number][] = [
    [current.latitude, current.longitude],
    ...actualFuturePoints.map((p): [number, number] => [p.latitude, p.longitude]),
  ]

  return (
    <div className="map-dark relative overflow-hidden rounded-lg border border-border" style={{ height }}>
      <MapContainer center={[current.latitude, current.longitude]} zoom={5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Storm's actual future path (what really happened next) - thin, muted */}
        {futurePositions.length > 1 && (
          <Polyline positions={futurePositions} pathOptions={{ color: '#8ea3bd', weight: 1.5, opacity: 0.5, dashArray: '2 6' }} />
        )}

        {/* Storm's actual path so far - solid, colored by intensity */}
        {pastPositions.length > 1 && (
          <Polyline positions={pastPositions} pathOptions={{ color: '#22d3ee', weight: 2, opacity: 0.7 }} />
        )}
        {pastTrack.map((p, i) => (
          <CircleMarker
            key={p.timestamp}
            center={[p.latitude, p.longitude]}
            radius={i === 0 ? 5 : 2.5}
            pathOptions={{
              color: i === 0 ? '#34d399' : windColor(p.wind_speed),
              fillColor: i === 0 ? '#34d399' : windColor(p.wind_speed),
              fillOpacity: 0.9,
            }}
          />
        ))}

        {/* Current position - large pulsing-style marker */}
        <CircleMarker
          center={[current.latitude, current.longitude]}
          radius={8}
          pathOptions={{ color: '#e5edf5', fillColor: '#22d3ee', fillOpacity: 1, weight: 2 }}
        >
          <Popup>
            <div className="text-xs">
              <p className="font-medium">{new Date(current.timestamp).toUTCString()}</p>
              <p>Wind: {current.wind_speed ?? 'N/A'} kt &middot; Pressure: {current.pressure ?? 'N/A'} hPa</p>
            </div>
          </Popup>
        </CircleMarker>

        {/* Model's predicted path from here */}
        {forecastPoints.length > 0 && (
          <Polyline positions={predictedPositions} pathOptions={{ color: '#f59e0b', weight: 3, dashArray: '6 6' }} />
        )}
        {forecastPoints.map((p) => (
          <div key={`pred-${p.hours_ahead}`}>
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
                  <p className="font-medium">Predicted +{p.hours_ahead}h</p>
                  <p>Typically within ~{p.expected_error_km} km (usually within ~{p.p90_error_km} km)</p>
                </div>
              </Popup>
            </CircleMarker>
          </div>
        ))}

        {/* What actually happened at those same lead times, for direct comparison */}
        {actualFuturePoints.length > 1 && (
          <Polyline positions={actualComparisonPositions} pathOptions={{ color: '#e5edf5', weight: 1.5, opacity: 0.8 }} />
        )}
        {actualFuturePoints.map((p) => (
          <CircleMarker
            key={`actual-${p.hours_ahead}`}
            center={[p.latitude, p.longitude]}
            radius={5}
            pathOptions={{ color: '#e5edf5', fillColor: '#07111f', fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-medium">Actual position at +{p.hours_ahead}h</p>
                <p>{new Date(p.timestamp).toUTCString()}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <WindLegend />
    </div>
  )
}
