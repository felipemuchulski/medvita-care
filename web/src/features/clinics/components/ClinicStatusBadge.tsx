export function ClinicStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}
    >
      {active ? 'Ativa' : 'Inativa'}
    </span>
  )
}
