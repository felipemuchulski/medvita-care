import type { ReactNode } from 'react'
export function ExamField({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="form-field">
      <label
        htmlFor={id}
        className="text-sm font-medium"
      >
        {label}
      </label>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-sm text-red-800"
        >
          {error}
        </p>
      )}
    </div>
  )
}
