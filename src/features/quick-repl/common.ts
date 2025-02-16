import z from 'zod'
import { whenSchema } from '../../common/when'

export const templateSchema = z.object({
  name: z.string(),
  defaultPath: z.string().optional(),
}).and(
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('file'),
      template: z.union([
        z.object({ content: z.union([z.string(), z.array(z.string())]) }),
        z.object({ path: z.string() }),
      ]).optional(),
    }),
    z.object({
      type: z.literal('directory'),
      template: z.object({
        path: z.string(),
        fileToOpen: z.string().optional(),
      }),
    })
  ])
)

export type Template = z.infer<typeof templateSchema>

export const commandSchema = z.object({
  name: z.string(),
  cwd: z.string(),
  command: z.union([z.string(), z.array(z.string())]),
  when: whenSchema.optional(),
})

export type Command = z.infer<typeof commandSchema>
