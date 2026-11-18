import { useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

// Read the notice once, then consume only its key from browser history state.
// The local notice survives the cleanup render, but not reload or a new screen.
export function useNavigationNotice(key: string, booleanMessage?: string) {
  const location = useLocation()
  const navigate = useNavigate()
  const value: unknown = location.state?.[key]
  const text =
    typeof value === 'string' ? value : value === true ? (booleanMessage ?? '') : ''
  const [notice, setNotice] = useState({
    source: location.key,
    path: location.pathname,
    text,
  })
  if (text && notice.source !== location.key)
    setNotice({ source: location.key, path: location.pathname, text })
  if (!text && notice.path !== location.pathname)
    setNotice({ source: location.key, path: location.pathname, text: '' })
  const consumed = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (value === undefined || consumed.current === location.key) return
    consumed.current = location.key
    const state = { ...location.state }
    delete state[key]
    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state },
    )
  }, [key, location, navigate, value])
  return notice.text
}
