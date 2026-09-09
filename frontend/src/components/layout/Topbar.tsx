export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-border bg-bg/70 px-8 py-5 backdrop-blur-sm">
      <h1 className="text-xl font-semibold text-text">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-text-dim">{subtitle}</p>}
    </header>
  )
}
