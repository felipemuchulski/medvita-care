export default function PatientStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  )
}
