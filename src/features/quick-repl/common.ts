import z from 'zod'
import { whenSchema } from '../../common/when'

export const templateSchema = z.object({
  name: z.string(),
}).and(
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('snippet'),
      languageId: z.string(),
      template: z.union([
        z.object({ content: z.union([z.string(), z.array(z.string())]) }),
        z.object({ path: z.string() }),
      ]).optional(),
    }),
    z.object({
      type: z.literal('file'),
      defaultPath: z.string().optional(),
      template: z.union([
        z.object({ content: z.union([z.string(), z.array(z.string())]) }),
        z.object({ path: z.string() }),
      ]).optional(),
    }),
    z.object({
      type: z.literal('directory'),
      defaultPath: z.string().optional(),
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
