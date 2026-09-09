import { api } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/States'
import { Badge } from '@/components/ui/Badge'
import { friendlyChannel, friendlyEra5Variable } from '@/lib/labels'

export function DataSources() {
  const health = useAsync(() => api.health(), [])
  const overview = useAsync(() => api.analyticsOverview(), [])
  const tcir = useAsync(() => api.tcirOverview(), [])
  const era5 = useAsync(() => api.era5Coverage(), [])

  if (health.loading || overview.loading || tcir.loading || era5.loading) {
    return <LoadingState label="Loading dataset information..." />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>TCIR Satellite Imagery</CardTitle>
          <Badge variant={health.data?.datasets.tcir ? 'success' : 'danger'}>
            {health.data?.datasets.tcir ? 'Available' : 'Not Found'}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-text-dim">
            Real satellite photos of past cyclones, used to train the AI wind-speed prediction model.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Info label="Images" value={tcir.data?.total_samples.toLocaleString() ?? '—'} />
            <Info label="Storms Covered" value={tcir.data?.unique_cyclones.toLocaleString() ?? '—'} />
            <Info label="Image Size" value="201 x 201 pixels" />
            <Info label="Image Types" value={tcir.data?.channels.map(friendlyChannel).join(', ') ?? '—'} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>IBTrACS Historical Tracks</CardTitle>
          <Badge variant={health.data?.datasets.ibtracs ? 'success' : 'danger'}>
            {health.data?.datasets.ibtracs ? 'Available' : 'Not Found'}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-text-dim">
            Official historical records of where every recorded cyclone traveled and how strong it got.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Info label="Track Points Recorded" value={overview.data?.total_track_points.toLocaleString() ?? '—'} />
            <Info label="Cyclones" value={overview.data?.total_cyclones.toLocaleString() ?? '—'} />
            <Info label="Region" value="North Indian Ocean" />
            <Info
              label="Years Covered"
              value={overview.data ? `${overview.data.season_range[0]}-${overview.data.season_range[1]}` : '—'}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ERA5 Environmental Reanalysis</CardTitle>
          <Badge variant={health.data?.datasets.era5 ? 'success' : 'danger'}>
            {health.data?.datasets.era5 ? 'Available' : 'Not Found'}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-text-dim">
            Background weather and ocean conditions (wind, pressure, sea temperature) for a specific
            time and place — used by the Cyclone Detail page's environmental lookup for any track
            point.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Info
              label="Time Range"
              value={era5.data?.available ? `${era5.data.start_time?.slice(0, 10)} to ${era5.data.end_time?.slice(0, 10)}` : '—'}
            />
            <Info
              label="Latitude"
              value={era5.data?.available ? `${era5.data.latitude_min}-${era5.data.latitude_max}` : '—'}
            />
            <Info
              label="Longitude"
              value={era5.data?.available ? `${era5.data.longitude_min}-${era5.data.longitude_max}` : '—'}
            />
            <Info label="Measurements" value={era5.data?.variables?.map(friendlyEra5Variable).join(', ') ?? '—'} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 text-xs text-text-dim">
          This application is an academic research and visualization platform. AI/rule-based
          predictions are experimental and must not be used for operational weather forecasting or
          public safety decisions.
        </CardContent>
      </Card>
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
