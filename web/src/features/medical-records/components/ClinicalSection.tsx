import type { ReactNode } from 'react'
export function ClinicalSection({
  id,
  title,
  description,
  number,
  errorCount = 0,
  onFocus,
  children,
}: {
  id: string
  title: string
  description: string
  number: string
  errorCount?: number
  onFocus: () => void
  children: ReactNode
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onFocusCapture={onFocus}
      className={`min-w-0 scroll-mt-6 space-y-5 rounded-xl border bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-6 ${errorCount ? 'border-red-300' : 'border-border'}`}
    >
      <header className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-sm font-semibold text-primary"
        >
          {number}
        </span>
        <div className="min-w-0">
          <h2
            id={`${id}-title`}
            className="text-lg font-semibold"
          >
            {title}
          </h2>
          <p
            id={`${id}-description`}
            className="mt-1 text-sm text-text-secondary"
          >
            {description}
          </p>
          {errorCount > 0 && (
            <p className="mt-1 text-sm font-medium text-red-800">
              {errorCount} campo(s) para revisar
            </p>
          )}
        </div>
      </header>
      {children}
    </section>
  )
}
