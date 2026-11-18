import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

type Rule = (value: string) => string
export const filterRule = {
  search: (value: string) => value.trim().slice(0, 150),
  page: (value: string) =>
    /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1_000_000
      ? String(Number(value))
      : '',
  uuid: (value: string) =>
    /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value)
      ? value
      : '',
  date: (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
      ? value
      : '',
  enum:
    (values: string[]): Rule =>
    (value) =>
      values.includes(value) ? value : '',
}
export function sanitizeFilters(params: URLSearchParams, rules: Record<string, Rule>) {
  const result = new URLSearchParams()
  for (const [key, rule] of Object.entries(rules)) {
    const value = rule(params.get(key) ?? '')
    if (value) result.set(key, value)
  }
  return result
}
export function useUrlFilters(
  rules: Record<string, Rule>,
  defaults: Record<string, string> = {},
) {
  const [params, setParams] = useSearchParams()
  const [resetKey, setResetKey] = useState(0)
  const clean = sanitizeFilters(params, rules)
  const serialized = clean.toString()
  useEffect(() => {
    if (params.toString() !== serialized) setParams(serialized, { replace: true })
  }, [params, serialized, setParams])
  const update = useCallback(
    (patch: Record<string, string>, replace = false) => {
      setParams(
        (previous) => {
          const next = sanitizeFilters(previous, rules)
          if (!Object.hasOwn(patch, 'page')) next.delete('page')
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return sanitizeFilters(next, rules)
        },
        { replace },
      )
    },
    [rules, setParams],
  )
  const values = { ...defaults, ...Object.fromEntries(clean) }
  return {
    values,
    update,
    resetKey,
    reset: () => {
      setResetKey((key) => key + 1)
      setParams(new URLSearchParams())
    },
    invalidPeriod: Boolean(values.from && values.to && values.from > values.to),
  }
}
export function periodQuery(from: string, to: string) {
  return {
    from: from ? `${from}T00:00:00-03:00` : undefined,
    to: to ? `${to}T23:59:59.999-03:00` : undefined,
  }
}
export function useDebouncedSearch(value: string, commit: (value: string) => void) {
  const [state, setState] = useState({ source: value, draft: value })
  if (state.source !== value) setState({ source: value, draft: value })
  useEffect(() => {
    if (state.draft.trim() === value) return
    const timer = setTimeout(() => commit(state.draft.trim()), 300)
    return () => clearTimeout(timer)
  }, [state.draft, value, commit])
  return {
    value: state.draft,
    onChange: (next: string) => {
      setState({ source: value, draft: next })
      if (!next.trim()) commit('')
    },
    flush: () => commit(state.draft.trim()),
  }
}
