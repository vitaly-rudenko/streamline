import type { FileType, TextEditor } from 'vscode'
import { ConditionContext } from './common/when'

export type GenerateConditionContextInput = TextEditor | { path: string; fileType: FileType } | undefined
export type GenerateConditionContext = (input: GenerateConditionContextInput) => ConditionContext
