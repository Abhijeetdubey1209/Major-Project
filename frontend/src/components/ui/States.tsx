import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-dim">
      <Loader2 className="animate-spin text-accent" size={28} />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function ErrorState({ label = 'Something went wrong.', onRetry }: { label?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-dim">
      <AlertTriangle className="text-danger" size={28} />
      <p className="text-sm">{label}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-panel-2"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ label = 'No data found.', hint }: { label?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-dim">
      <Inbox size={28} />
      <p className="text-sm">{label}</p>
      {hint && <p className="text-xs">{hint}</p>}
    </div>
  )
}
