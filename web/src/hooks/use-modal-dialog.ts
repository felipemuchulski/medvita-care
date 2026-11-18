import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useAuthorizationView } from '../lib/authorized-query'

let scrollLocks = 0
let originalOverflow = ''
function visible(element: HTMLElement) {
  return (
    element.isConnected &&
    !element.closest('[hidden], [inert], dialog:not([open])') &&
    getComputedStyle(element).display !== 'none' &&
    getComputedStyle(element).visibility !== 'hidden'
  )
}
export function useModalDialog(
  ref: RefObject<HTMLDialogElement | null>,
  open = true,
  returnFocus?: () => HTMLElement | null,
) {
  const { view, live } = useAuthorizationView()
  const allowedOpen = open && !live.blocked && view.revision === live.revision
  const restore = useRef(returnFocus)
  useLayoutEffect(() => {
    restore.current = returnFocus
  }, [returnFocus])
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!allowedOpen || !dialog) return
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dialog.open) dialog.showModal()
    // React autoFocus would move focus before this effect captures the opener.
    dialog.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)')?.focus()
    if (scrollLocks++ === 0) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ].filter(visible)
      const first = controls[0],
        last = controls.at(-1)
      if (!first) {
        event.preventDefault()
        dialog.focus()
        return
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialog)
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', keydown)
    return () => {
      dialog.removeEventListener('keydown', keydown)
      dialog.close()
      if (--scrollLocks === 0) document.body.style.overflow = originalOverflow
      const requested = restore.current?.()
      const target =
        requested && visible(requested)
          ? requested
          : previous && visible(previous)
            ? previous
            : document.getElementById('main-content')
      // Wait for React's commit focus restoration before restoring the opener.
      queueMicrotask(() => {
        const destination = target && visible(target)
          ? target
          : document.getElementById('main-content')
        if (!destination || !visible(destination)) return
        const top = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')]
          .filter(visible)
          .at(-1)
        if (!top || top.contains(destination)) destination.focus({ preventScroll: true })
      })
    }
  }, [allowedOpen, ref])
}
