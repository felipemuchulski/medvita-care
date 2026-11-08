import { z } from 'zod'
export const userSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(150, 'Use até 150 caracteres.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Informe um e-mail válido.').max(150, 'Use até 150 caracteres.')),
  password: z.string(),
  isSystemAdmin: z.boolean(),
})
export type UserValues = z.infer<typeof userSchema>
export const createUserSchema = userSchema.extend({
  password: z
    .string()
    .min(8, 'Use pelo menos 8 caracteres.')
    .max(255, 'Use até 255 caracteres.'),
})
