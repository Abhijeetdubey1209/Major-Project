import {
  Activity,
  Database,
  Gauge,
  Globe,
  LayoutDashboard,
  Map as MapIcon,
  Zap,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/utils'

// '/satellite' (Satellite Explorer) is intentionally left off the nav but still routed
// in App.tsx -- the page itself is untouched, just not linked from the sidebar.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/cyclones', label: 'Cyclone Explorer', icon: MapIcon },
  { to: '/map', label: 'Global Map', icon: Globe },
  { to: '/simulator', label: 'Cyclone Simulator', icon: Zap },
  { to: '/predict', label: 'Risk Estimation', icon: Gauge },
  { to: '/data', label: 'Data Sources', icon: Database },
]

export function Sidebar() {
  const { data: health } = useAsync(() => api.health(), [])

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-panel/40">
      <div className="flex items-center gap-2 px-5 py-6">
        <span className="text-2xl">🌪</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-widest text-text">CYCLONE</p>
          <p className="text-sm font-semibold tracking-widest text-accent">INTELLIGENCE</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-dim hover:bg-panel-2 hover:text-text',
              )
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-dim">
          <Activity size={13} /> Dataset Status
        </p>
        <ul className="space-y-1 text-xs">
          <StatusRow label="Storm Tracks" hint="IBTrACS historical track data" available={health?.datasets.ibtracs} />
          <StatusRow label="Satellite Images" hint="TCIR satellite imagery" available={health?.datasets.tcir} />
          <StatusRow label="Weather Data" hint="ERA5 environmental reanalysis" available={health?.datasets.era5} />
        </ul>
      </div>
    </aside>
  )
}

function StatusRow({
  label,
  hint,
  available,
}: {
  label: string
  hint: string
  available: boolean | undefined
}) {
  return (
    <li className="flex items-center gap-2 text-text-dim" title={hint}>
      <span
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          available === undefined ? 'bg-text-dim' : available ? 'bg-emerald-400' : 'bg-danger',
        )}
      />
      {label}
    </li>
  )
}
