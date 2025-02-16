import z from 'zod'
import { whenSchema } from '../../common/when'

export const templateSchema = z.object({
  name: z.string(),
  type: z.enum(['file', 'directory']),
  path: z.string(),
  template: z.union([
    z.object({ content: z.string() }),
    z.object({ path: z.string() }),
  ]).optional()
})

export type Template = z.infer<typeof templateSchema>

export const commandSchema = z.object({
  name: z.string(),
  cwd: z.string(),
  command: z.union([z.string(), z.array(z.string())]),
  when: whenSchema.optional(),
})

export type Command = z.infer<typeof commandSchema>
