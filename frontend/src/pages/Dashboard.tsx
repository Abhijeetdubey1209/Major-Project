import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CloudLightning, Gauge, MapPin, Wind } from 'lucide-react'
import { api } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { Badge, windSpeedVariant } from '@/components/ui/Badge'

export function Dashboard() {
  const overview = useAsync(() => api.analyticsOverview(), [])
  const yearly = useAsync(() => api.analyticsYearly(), [])
  const strongest = useAsync(() => api.strongestCyclones(6), [])

  if (overview.loading) return <LoadingState label="Loading historical cyclone statistics..." />
  if (overview.error || !overview.data) return <ErrorState label="Could not load dashboard statistics." />

  const o = overview.data
  const recentYearly = (yearly.data ?? []).filter((y) => y.season >= 1980)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Cyclones" value={o.total_cyclones.toLocaleString()} icon={CloudLightning} accent />
        <StatCard label="Positions Recorded" value={o.total_track_points.toLocaleString()} icon={MapPin} />
        <StatCard label="Strongest Wind Recorded" value={`${o.max_wind_recorded ?? '—'} kt`} icon={Wind} />
        <StatCard label="Lowest Pressure Recorded" value={`${o.min_pressure_recorded ?? '—'} hPa`} icon={Gauge} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cyclones by Year (since 1980)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {yearly.loading ? (
            <LoadingState label="Loading yearly trend..." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentYearly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2f47" />
                <XAxis dataKey="season" stroke="#8ea3bd" fontSize={11} interval={4} />
                <YAxis stroke="#8ea3bd" fontSize={11} />
                <Tooltip contentStyle={{ background: '#101d30', border: '1px solid #1f2f47', borderRadius: 8 }} />
                <Bar dataKey="count" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strongest Recorded Cyclones</CardTitle>
        </CardHeader>
        <CardContent>
          {strongest.loading ? (
            <LoadingState label="Loading leaderboard..." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-dim">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Season</th>
                  <th className="pb-2">Max Wind (knots)</th>
                  <th className="pb-2">Min Pressure (hPa)</th>
                </tr>
              </thead>
              <tbody>
                {strongest.data?.map((c) => (
                  <tr key={c.sid} className="border-t border-border">
                    <td className="py-2">
                      <Link to={`/cyclones/${c.sid}`} className="hover:text-accent">
                        {c.name ?? 'Unnamed storm'}
                      </Link>
                    </td>
                    <td className="py-2 text-text-dim">{c.season}</td>
                    <td className="py-2">
                      <Badge variant={windSpeedVariant(c.max_wind)}>{c.max_wind} kt</Badge>
                    </td>
                    <td className="py-2 text-text-dim">{c.min_pressure ?? '—'} hPa</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
