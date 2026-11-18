import { useDebouncedSearch } from '../../lib/list-filters'
export function SearchField({
  value,
  onChange,
  label,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
}) {
  const search = useDebouncedSearch(value, onChange)
  return (
    <label className={`form-field min-w-0 ${className}`}>
      <span>{label}</span>
      <input
        type="search"
        maxLength={150}
        value={search.value}
        onChange={(event) => search.onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            search.flush()
          }
        }}
        className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary"
      />
    </label>
  )
}
