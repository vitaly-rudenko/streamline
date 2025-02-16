import z from 'zod'
import { conditionSchema, whenSchema } from '../../common/when'

export type Config = Record<string, unknown>

export const ruleSchema = z.object({
  apply: z.array(z.string()),
  when: whenSchema,
})

export type Rule = z.infer<typeof ruleSchema>
