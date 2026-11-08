import { useState } from 'react'
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormSetFocus,
} from 'react-hook-form'
import { textFields, type EncounterValues } from '../lib/encounter'
import { ClinicalSection } from './ClinicalSection'
import { ClinicalTextFields } from './ClinicalTextFields'
import { OcularMeasurements } from './OcularMeasurements'

const sections = [
  {
    id: 'clinical-anamnesis',
    label: 'Anamnese',
    fields: ['chiefComplaint', 'anamnesis'],
  },
  {
    id: 'clinical-acuity',
    label: 'Acuidade visual',
    fields: ['visualAcuityRight', 'visualAcuityLeft'],
  },
  {
    id: 'clinical-pressure',
    label: 'Pressão intraocular',
    fields: ['intraocularPressureRight', 'intraocularPressureLeft'],
  },
  {
    id: 'clinical-assessment',
    label: 'Avaliação e conduta',
    fields: ['clinicalAssessment', 'plan', 'clinicalNotes'],
  },
] as const
const ocularLabels = {
  visualAcuityRight: 'Acuidade visual OD',
  visualAcuityLeft: 'Acuidade visual OS',
  intraocularPressureRight: 'Pressão intraocular OD',
  intraocularPressureLeft: 'Pressão intraocular OS',
}
function fieldLabel(name: keyof EncounterValues) {
  return (
    textFields.find((field) => field.name === name)?.label ??
    ocularLabels[name as keyof typeof ocularLabels]
  )
}

export function ClinicalFormSections({
  register,
  control,
  errors,
  setFocus,
}: {
  register: UseFormRegister<EncounterValues>
  control: Control<EncounterValues>
  errors: FieldErrors<EncounterValues>
  setFocus: UseFormSetFocus<EncounterValues>
}) {
  const [activeSection, setActiveSection] = useState('clinical-anamnesis')
  const invalidFields = sections
    .flatMap((section) => section.fields.map((name) => name as keyof EncounterValues))
    .filter((name) => Boolean(errors[name]))
  function sectionErrors(id: string) {
    return (
      sections
        .find((section) => section.id === id)
        ?.fields.filter((name) => Boolean(errors[name])).length ?? 0
    )
  }
  function goToSection(id: string) {
    setActiveSection(id)
    const element = document.getElementById(id)
    element?.focus({ preventScroll: true })
    element?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }
  function focusField(name: keyof EncounterValues) {
    const section = sections.find((section) =>
      (section.fields as readonly string[]).includes(name),
    )
    if (section) setActiveSection(section.id)
    requestAnimationFrame(() => {
      setFocus(name)
      document
        .getElementById(name)
        ?.scrollIntoView({ block: 'center', behavior: 'instant' })
    })
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="rounded-xl border border-border bg-white p-3 sm:p-4">
        <nav
          aria-label="Seções do formulário clínico"
          className="grid grid-cols-2 gap-2 xl:grid-cols-4"
        >
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              aria-current={activeSection === section.id ? 'location' : undefined}
              onClick={() => goToSection(section.id)}
              className={`min-h-11 min-w-0 rounded-lg border px-3 py-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${activeSection === section.id ? 'border-primary bg-primary-light text-primary' : 'border-border text-text-secondary hover:bg-background'}`}
            >
              <span>{section.label}</span>
              {sectionErrors(section.id) > 0 && (
                <span className="mt-1 block text-xs text-red-800">Revisar campos</span>
              )}
            </button>
          ))}
        </nav>
      </div>
      {invalidFields.length > 0 && (
        <section
          role="alert"
          aria-labelledby="clinical-errors-title"
          className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-4"
        >
          <h2
            id="clinical-errors-title"
            className="font-semibold text-red-900"
          >
            Revise os campos indicados
          </h2>
          <ul>
            {invalidFields.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className="min-h-11 text-left text-sm text-red-900 underline focus-visible:outline-2 focus-visible:outline-red-800"
                  onClick={() => focusField(name)}
                >
                  {fieldLabel(name)}: {errors[name]?.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ClinicalSection
        id="clinical-anamnesis"
        title="Anamnese"
        description="Motivo da consulta, história clínica e antecedentes."
        number="01"
        errorCount={sectionErrors('clinical-anamnesis')}
        onFocus={() => setActiveSection('clinical-anamnesis')}
      >
        <ClinicalTextFields
          fields={textFields.slice(0, 2)}
          register={register}
          errors={errors}
        />
      </ClinicalSection>

      <ClinicalSection
        id="clinical-acuity"
        title="Acuidade visual"
        description="Registre separadamente as medidas de cada olho."
        number="02"
        errorCount={sectionErrors('clinical-acuity')}
        onFocus={() => setActiveSection('clinical-acuity')}
      >
        <OcularMeasurements
          control={control}
          errors={errors}
          kind="acuity"
        />
      </ClinicalSection>

      <ClinicalSection
        id="clinical-pressure"
        title="Pressão intraocular"
        description="Medidas de pressão para olho direito e olho esquerdo."
        number="03"
        errorCount={sectionErrors('clinical-pressure')}
        onFocus={() => setActiveSection('clinical-pressure')}
      >
        <OcularMeasurements
          control={control}
          errors={errors}
          kind="pressure"
        />
      </ClinicalSection>

      <ClinicalSection
        id="clinical-assessment"
        title="Avaliação e conduta"
        description="Avaliação clínica, plano e observações do atendimento."
        number="04"
        errorCount={sectionErrors('clinical-assessment')}
        onFocus={() => setActiveSection('clinical-assessment')}
      >
        <ClinicalTextFields
          fields={textFields.slice(2)}
          register={register}
          errors={errors}
        />
      </ClinicalSection>
    </div>
  )
}
