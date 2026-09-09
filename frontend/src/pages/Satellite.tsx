import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import type { IntensityPrediction } from '@/types'
import { useAsync } from '@/hooks/useAsync'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/utils'
import { CHANNEL_LABELS, friendlyDataset } from '@/lib/labels'

const DATASETS = ['CPAC', 'IO', 'SH']
const CHANNELS = [
  { index: 0, code: 'IR1' },
  { index: 1, code: 'WV' },
  { index: 2, code: 'VIS' },
  { index: 3, code: 'PMW' },
]

export function Satellite() {
  const overview = useAsync(() => api.tcirOverview(), [])
  const model = useAsync(() => api.tcirModel(), [])
  const [dataset, setDataset] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const [channel, setChannel] = useState(0)
  const limit = 24

  const samples = useAsync(() => api.tcirSamples({ page, limit, dataset }), [dataset, page])

  if (overview.loading) return <LoadingState label="Loading satellite dataset overview..." />
  if (overview.error || !overview.data) return <ErrorState label="Could not load TCIR overview." />

  const o = overview.data
  const totalPages = samples.data ? Math.max(1, Math.ceil(samples.data.total / limit)) : 1

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 py-5 text-sm md:grid-cols-4">
          <Info label="Total Samples" value={o.total_samples.toLocaleString()} />
          <Info label="Unique Cyclones" value={o.unique_cyclones.toLocaleString()} />
          <Info label="Time Range" value={`${o.time_range[0].slice(0, 4)}-${o.time_range[1].slice(0, 4)}`} />
          <Info label="Wind Speed Range" value={`${o.vmax_stats.min}-${o.vmax_stats.max} knots`} />
        </CardContent>
      </Card>

      {model.data && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 py-4 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Sparkles size={16} className="text-accent" />
              AI Intensity Model
            </span>
            {model.data.available ? (
              <>
                <span className="text-text-dim">
                  Trained on {model.data.training_samples?.toLocaleString()} satellite images from{' '}
                  {model.data.unique_cyclones} past cyclones
                </span>
                <span className="text-text-dim" title="Mean Absolute Error — average difference between predicted and actual wind speed">
                  Typical error: <span className="text-text">±{model.data.test_metrics?.mae.toFixed(0)} knots</span>
                </span>
                <span
                  className="text-text-dim"
                  title="R² (coefficient of determination) — how well the model explains real wind-speed variation, from 0 (no better than guessing the average) to 1 (perfect)"
                >
                  Model fit score: <span className="text-text">{model.data.test_metrics?.r2.toFixed(2)} / 1.00</span>
                </span>
              </>
            ) : (
              <span className="text-text-dim">Not trained yet — run backend/scripts/train_intensity_model.py</span>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-text-dim">Filter by Dataset</p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setDataset(undefined)
                setPage(1)
              }}
              className={cn(
                'w-full rounded-md px-3 py-1.5 text-left text-sm',
                dataset === undefined ? 'bg-accent/10 text-accent' : 'text-text-dim hover:bg-panel-2',
              )}
            >
              All ({o.total_samples})
            </button>
            {DATASETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDataset(d)
                  setPage(1)
                }}
                className={cn(
                  'w-full rounded-md px-3 py-1.5 text-left text-sm',
                  dataset === d ? 'bg-accent/10 text-accent' : 'text-text-dim hover:bg-panel-2',
                )}
              >
                {friendlyDataset(d)} ({o.dataset_distribution[d] ?? 0})
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sample Browser</CardTitle>
            </CardHeader>
            <CardContent>
              {samples.loading && <LoadingState label="Retrieving satellite samples..." />}
              {samples.data && samples.data.items.length === 0 && <EmptyState label="No samples found." />}
              {samples.data && samples.data.items.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {samples.data.items.map((s) => (
                      <button
                        key={s.index}
                        type="button"
                        onClick={() => setSelected(s.index)}
                        className={cn(
                          'overflow-hidden rounded-md border text-left transition-colors',
                          selected === s.index ? 'border-accent' : 'border-border hover:border-text-dim',
                        )}
                      >
                        <img
                          src={api.tcirSampleImageUrl(s.index, 0)}
                          alt={`sample ${s.index}`}
                          className="aspect-square w-full object-cover"
                          loading="lazy"
                        />
                        <p className="truncate px-1.5 py-1 text-[10px] text-text-dim">{s.id}</p>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-text-dim">
                    <span>
                      Page {page} of {totalPages} &middot; {samples.data.total.toLocaleString()} samples
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
            </CardContent>
          </Card>

          {selected != null && <SampleDetail key={selected} index={selected} channel={channel} onChannel={setChannel} />}
        </div>
      </div>
    </div>
  )
}

function SampleDetail({
  index,
  channel,
  onChannel,
}: {
  index: number
  channel: number
  onChannel: (c: number) => void
}) {
  const meta = useAsync(() => api.tcirSample(index), [index])
  const [prediction, setPrediction] = useState<IntensityPrediction | null>(null)
  const [predicting, setPredicting] = useState(false)

  async function runAnalysis() {
    setPredicting(true)
    try {
      setPrediction(await api.tcirPredict(index))
    } finally {
      setPredicting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sample #{index}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
        <div>
          <img
            src={api.tcirSampleImageUrl(index, channel)}
            alt="satellite sample"
            className="w-full rounded-lg border border-border"
          />
          <div className="mt-2 flex gap-1">
            {CHANNELS.map((c) => (
              <button
                key={c.index}
                type="button"
                onClick={() => onChannel(c.index)}
                title={CHANNEL_LABELS[c.code].hint}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1 text-xs',
                  channel === c.index
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-text-dim hover:bg-panel-2',
                )}
              >
                {CHANNEL_LABELS[c.code].name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-text-dim">Hover a button above for what it shows.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {meta.data && (
            <>
              <Info label="Storm ID" value={meta.data.id} />
              <Info label="Region" value={friendlyDataset(meta.data.dataset)} />
              <Info label="Location" value={`${meta.data.lat}°, ${meta.data.lon}°`} />
              <Info label="Date & Time" value={meta.data.time} />
              <Info label="Max Wind Speed" value={`${meta.data.vmax} knots`} />
              <Info label="Min. Air Pressure" value={`${meta.data.mslp} hPa`} />
              <Info
                label="Storm Size"
                value={String(meta.data.r35_4qavg)}
                hint="Average radius of gale-force winds (34+ knots) around the storm center, as recorded in the source dataset"
              />
            </>
          )}

          <button
            type="button"
            onClick={runAnalysis}
            disabled={predicting}
            className="col-span-2 mt-1 flex items-center justify-center gap-2 rounded-md bg-accent py-2 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles size={15} />
            {predicting ? 'Running AI Analysis...' : 'Run AI Analysis'}
          </button>

          {prediction && !prediction.available && (
            <div className="col-span-2 rounded-md border border-border bg-panel-2 p-3 text-xs text-text-dim">
              {prediction.reason}
            </div>
          )}
          {prediction?.available && (
            <div className="col-span-2 rounded-md border border-accent/30 bg-accent/5 p-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-text-dim">AI Predicted</p>
                  <p className="text-lg font-semibold text-accent">{prediction.predicted_vmax} kt</p>
                </div>
                <div>
                  <p className="text-xs text-text-dim">Actually Observed</p>
                  <p className="text-lg font-semibold">{prediction.actual_vmax} kt</p>
                </div>
                <div>
                  <p className="text-xs text-text-dim">Difference</p>
                  <p className="text-lg font-semibold">{prediction.error} kt</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-text-dim">
                Wind speed in knots (kt). Model's typical error on unseen storms: ±{prediction.test_mae?.toFixed(0)} kt.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Info({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-panel-2 p-3" title={hint}>
      <p className="text-xs text-text-dim">{label}</p>
      <p className="text-base font-medium">{value}</p>
    </div>
  )
}
