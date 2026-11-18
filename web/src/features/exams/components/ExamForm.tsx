import { FormErrorSummary } from '../../../components/forms/FormFeedback'
import { useFormErrorFocus } from '../../../lib/form-feedback'
import { useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { PatientSelector, buttonClass } from '../../appointments/components/Selectors'
import { useUnsavedClinicalChanges } from '../../medical-records/hooks/use-unsaved-clinical-changes'
import { useExamMutations, useExamTypes } from '../hooks/use-exams'
import { examError } from '../lib/exam'
import { examSchema, type ExamValues } from '../schemas/exam'
import { ExamEncounterSelect } from './ExamEncounterSelect'
import { ExamRequestFields } from './ExamRequestFields'
import { ExamLeavePrompt } from './ExamLeavePrompt'
export function ExamForm({
  clinic,
  user,
  initialPatient,
  initialEncounter,
  onCreated,
}: {
  clinic: string
  user: string
  initialPatient: string
  initialEncounter: string
  onCreated: (id: string) => void
}) {
  const { formRef, focusErrors } = useFormErrorFocus()
  const types = useExamTypes(clinic, user)
  const mutations = useExamMutations(clinic, user)
  const lock = useRef(false)
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ExamValues>({
    shouldFocusError: false,
    resolver: zodResolver(examSchema),
    defaultValues: {
      patientId: initialPatient,
      encounterId: initialEncounter,
      examTypeId: '',
      laterality: 'AO',
      notes: '',
    },
  })
  const patient = useWatch({ control, name: 'patientId' })
  const blocker = useUnsavedClinicalChanges(isDirty, isSubmitting)
  async function submit(values: ExamValues) {
    if (lock.current) return
    lock.current = true
    try {
      const record = await mutations.create.mutateAsync({
        patientId: values.patientId,
        examTypeId: values.examTypeId,
        laterality: values.laterality,
        encounterId: values.encounterId || undefined,
        notes: values.notes,
      })
      reset(values)
      onCreated(record.id)
    } catch (error) {
      setError('root', { message: examError(error) })
      focusErrors()
    } finally {
      lock.current = false
      mutations.create.reset()
    }
  }
  if (types.isPending) return <p role="status">Carregando tipos de exame...</p>
  if (types.isError)
    return (
      <div className="space-y-3">
        <p>{examError(types.error)}</p>
        <button
          className={buttonClass}
          onClick={() => void types.refetch()}
        >
          Tentar novamente
        </button>
      </div>
    )
  if (!types.data.length)
    return (
      <p role="status">
        Nenhum tipo de exame ativo disponível. Solicite a verificação do catálogo à
        administração.
      </p>
    )
  return (
    <form
      ref={formRef}
      onSubmit={(event) => void handleSubmit(submit, focusErrors)(event)}
      className="space-y-5"
      aria-busy={isSubmitting}
      noValidate
    >
      <FormErrorSummary errors={errors} />
      <fieldset
        disabled={isSubmitting}
        className="min-w-0 space-y-5 rounded-xl border border-border bg-white p-4 sm:p-6"
      >
        <legend className="px-1 text-lg font-semibold">Paciente e atendimento</legend>
        <div
          aria-describedby={errors.patientId ? 'exam-patient-error' : undefined}
          aria-invalid={Boolean(errors.patientId)}
        >
          <Controller
            name="patientId"
            control={control}
            render={({ field }) => (
              <PatientSelector
                clinic={clinic}
                invalid={Boolean(errors.patientId)}
                describedBy={errors.patientId ? 'exam-patient-error' : undefined}
                selectRef={field.ref}
                value={field.value}
                activeOnly
                onChange={(value) => {
                  field.onChange(value)
                  setValue('encounterId', '', { shouldDirty: true })
                }}
              />
            )}
          />
          {errors.patientId && (
            <p
              id="exam-patient-error"

              className="text-sm text-red-800"
            >
              {errors.patientId.message}
            </p>
          )}
        </div>
        <Controller
          name="encounterId"
          control={control}
          render={({ field }) => (
            <ExamEncounterSelect
              key={patient}
              clinic={clinic}
              user={user}
              patient={patient}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {errors.encounterId && (
          <p className="text-sm text-red-800">{errors.encounterId.message}</p>
        )}
      </fieldset>
      <fieldset
        disabled={isSubmitting}
        className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 sm:p-6"
      >
        <legend className="px-1 text-lg font-semibold">Informações do exame</legend>
        <ExamRequestFields
          register={register}
          errors={errors}
          types={types.data}
        />
      </fieldset>
      <p className="text-sm text-text-secondary">
        A data da solicitação e o profissional solicitante serão registrados ao salvar.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          className={buttonClass}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Salvando...' : 'Solicitar exame'}
        </button>
        <Link
          className={buttonClass}
          to="/exames"
        >
          Voltar aos exames
        </Link>
      </div>
      <ExamLeavePrompt
        blocker={blocker}
        pending={isSubmitting}
      />
    </form>
  )
}
