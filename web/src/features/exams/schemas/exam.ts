import { z } from 'zod'
export const examSchema = z.object({
  patientId: z.uuid('Selecione um paciente.'),
  examTypeId: z.uuid('Selecione um tipo de exame.'),
  encounterId: z.union([z.literal(''), z.uuid('Selecione um atendimento válido.')]),
  laterality: z.enum(['OD', 'OS', 'AO']),
  notes: z.string().trim().max(4000, 'Use até 4.000 caracteres.'),
})
export type ExamValues = z.infer<typeof examSchema>
export const resultSchema = z.object({
  resultText: z
    .string()
    .trim()
    .min(1, 'Informe o resultado.')
    .max(12000, 'Use até 12.000 caracteres.'),
  performedAt: z
    .string()
    .min(1, 'Informe a data de realização.')
    .refine(
      (value) => Number.isFinite(Date.parse(`${value}-03:00`)),
      'Informe uma data válida.',
    ),
})
export type ResultValues = z.infer<typeof resultSchema>
export const updateExamSchema = examSchema.pick({ laterality: true, notes: true })
export type UpdateExamValues = z.infer<typeof updateExamSchema>
