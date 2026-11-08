import { ClinicalDialog } from '../../medical-records/components/ClinicalDialog'
import type { useUnsavedClinicalChanges } from '../../medical-records/hooks/use-unsaved-clinical-changes'
export function ExamLeavePrompt({
  blocker,
  pending,
}: {
  blocker: ReturnType<typeof useUnsavedClinicalChanges>
  pending: boolean
}) {
  if (blocker.state !== 'blocked') return null
  return (
    <ClinicalDialog
      title={pending ? 'Aguarde o salvamento' : 'Descartar alterações?'}
      label="Descartar e continuar"
      pending={pending}
      onClose={() => blocker.reset()}
      onConfirm={() => {
        if (!pending) blocker.proceed()
      }}
    >
      <p>
        {pending
          ? 'A operação ainda está em andamento.'
          : 'As alterações não salvas serão descartadas.'}
      </p>
    </ClinicalDialog>
  )
}
