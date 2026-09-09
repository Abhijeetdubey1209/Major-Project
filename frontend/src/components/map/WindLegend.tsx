const BANDS = [
  { color: '#38bdf8', label: 'Low', range: 'under 34 kt (~39 mph)' },
  { color: '#22d3ee', label: 'Moderate', range: '34–63 kt (~39–72 mph)' },
  { color: '#f59e0b', label: 'High', range: '64–112 kt (~74–129 mph)' },
  { color: '#f87171', label: 'Severe', range: '113+ kt (~130+ mph)' },
]

export function WindLegend() {
  return (
    <div className="absolute bottom-3 left-3 z-[1000] rounded-lg border border-border bg-panel/90 p-3 text-xs shadow-lg backdrop-blur-sm">
      <p className="mb-2 font-medium text-text-dim">Wind Intensity</p>
      <div className="space-y-1">
        {BANDS.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="h-2 w-4 shrink-0 rounded-sm" style={{ background: b.color }} />
            <span className="text-text">{b.label}</span>
            <span className="text-text-dim">{b.range}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 border-t border-border pt-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#34d399' }} />
          <span className="text-text-dim">Start</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#f87171' }} />
          <span className="text-text-dim">End</span>
        </span>
      </div>
      <p className="mt-2 max-w-[180px] text-[10px] leading-snug text-text-dim">
        kt = knots, a wind-speed unit used in cyclone tracking (1 kt ≈ 1.15 mph)
      </p>
    </div>
  )
}
