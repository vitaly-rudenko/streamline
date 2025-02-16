import type { FileType, TextEditor } from 'vscode'
import { ConditionContext } from './common/when'

export type GenerateConditionContext = (
  input: TextEditor | { path: string; fileType: FileType } | undefined
) => ConditionContext
