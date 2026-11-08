import { z } from 'zod'
import { normalizeClinicDocument } from '../lib/clinic'
const text = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`)
export const clinicSchema = z.object({
  name: text(150).min(1, 'Informe o nome da clínica.'),
  document: z
    .string()
    .transform(normalizeClinicDocument)
    .pipe(
      z
        .string()
        .min(1, 'Informe o documento da clínica.')
        .max(14, 'Use até 14 letras ou números no documento.'),
    ),
  phone: text(20),
  email: text(150).refine(
    (value) => !value || z.email().safeParse(value).success,
    'Informe um e-mail válido.',
  ),
  zipCode: text(8),
  street: text(150),
  number: text(20),
  complement: text(100),
  neighborhood: text(100),
  city: text(100),
  state: text(2),
})
export type ClinicFormInput = z.input<typeof clinicSchema>
export type ClinicFormValues = z.output<typeof clinicSchema>
