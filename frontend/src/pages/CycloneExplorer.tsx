import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Card } from '@/components/ui/Card'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { Badge, windSpeedVariant } from '@/components/ui/Badge'

export function CycloneExplorer() {
  const [search, setSearch] = useState('')
  const [season, setSeason] = useState('')
  const [minWind, setMinWind] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, loading, error } = useAsync(
    () =>
      api.listCyclones({
        page,
        limit,
        search: search || undefined,
        season: season ? Number(season) : undefined,
        min_wind: minWind ? Number(minWind) : undefined,
      }),
    [search, season, minWind, page],
  )

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-text-dim">Filters</p>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-text-dim">Search by name</label>
            <input
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
              placeholder="e.g. GAY"
              className="w-full rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-dim">Season</label>
            <input
              value={season}
              onChange={(e) => {
                setPage(1)
                setSeason(e.target.value)
              }}
              placeholder="e.g. 1999"
              type="number"
              className="w-full rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-dim">Min. Wind Speed (knots)</label>
            <input
              value={minWind}
              onChange={(e) => {
                setPage(1)
                setMinWind(e.target.value)
              }}
              placeholder="e.g. 64"
              type="number"
              className="w-full rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
          {(search || season || minWind) && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSeason('')
                setMinWind('')
                setPage(1)
              }}
              className="text-xs text-accent hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading && <LoadingState label="Loading cyclone records..." />}
        {error && <ErrorState label="Could not load cyclones." />}
        {data && data.items.length === 0 && (
          <EmptyState label="No cyclones found matching your filters." hint="Try clearing filters." />
        )}
        {data && data.items.length > 0 && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-dim">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Season</th>
                  <th className="px-5 py-3">Basin</th>
                  <th className="px-5 py-3">Start</th>
                  <th className="px-5 py-3">Max Wind (knots)</th>
                  <th className="px-5 py-3">Min Pressure (hPa)</th>
                  <th className="px-5 py-3" title="Number of recorded positions along the storm's path">
                    Records Tracked
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.sid} className="border-b border-border/60 hover:bg-panel-2">
                    <td className="px-5 py-3">
                      <Link to={`/cyclones/${c.sid}`} className="font-medium hover:text-accent">
                        {c.name ?? 'Unnamed storm'}
                      </Link>
                      <p className="text-xs text-text-dim" title="Storm ID">{c.sid}</p>
                    </td>
                    <td className="px-5 py-3 text-text-dim">{c.season}</td>
                    <td className="px-5 py-3 text-text-dim">{c.basin}</td>
                    <td className="px-5 py-3 text-text-dim">
                      {c.start_time ? new Date(c.start_time).toISOString().slice(0, 10) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={windSpeedVariant(c.max_wind)}>{c.max_wind ?? '—'} kt</Badge>
                    </td>
                    <td className="px-5 py-3 text-text-dim">{c.min_pressure ?? '—'} hPa</td>
                    <td className="px-5 py-3 text-text-dim">{c.track_points_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-3 text-xs text-text-dim">
              <span>
                Page {page} of {totalPages} &middot; {data.total.toLocaleString()} cyclones
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
