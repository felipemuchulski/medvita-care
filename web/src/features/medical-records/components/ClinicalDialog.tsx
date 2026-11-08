import { useEffect, useId, useRef, type ReactNode } from 'react'
import { buttonClass } from '../../appointments/components/Selectors'
export function ClinicalDialog({
  title,
  children,
  pending,
  onClose,
  onConfirm,
  label,
}: {
  title: string
  children: ReactNode
  pending?: boolean
  onClose: () => void
  onConfirm: () => void
  label: string
}) {
  const titleId = useId()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    dialog.showModal()
    return () => {
      dialog.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onClose()
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg space-y-4 overflow-y-auto rounded-xl p-4 backdrop:bg-black/40 sm:p-6"
    >
      <h2
        id={titleId}
        className="text-xl font-semibold"
      >
        {title}
      </h2>
      {children}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          autoFocus
          className={buttonClass}
          onClick={onClose}
          disabled={pending}
        >
          Voltar
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? 'Processando...' : label}
        </button>
      </div>
    </dialog>
  )
}
