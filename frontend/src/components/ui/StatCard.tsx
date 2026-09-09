import type { LucideIcon } from 'lucide-react'
import { Card } from './Card'

interface StatCardProps {
  label: string
  value: string
  icon?: LucideIcon
  accent?: boolean
}

export function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-dim">{label}</p>
          <p className={accent ? 'mt-2 text-3xl font-semibold text-accent' : 'mt-2 text-3xl font-semibold text-text'}>
            {value}
          </p>
        </div>
        {Icon && (
          <div className="rounded-lg bg-panel-2 p-2 text-accent">
            <Icon size={20} />
          </div>
        )}
      </div>
    </Card>
  )
}
