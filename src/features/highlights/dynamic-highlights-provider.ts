import type { Uri } from 'vscode'
import { Highlight } from './common'

export type DynamicHighlightsProvider = {
  name: string
  getHighlights: (uri: Uri) => Highlight[]
  subscribe?: (callback: Function) => void
}
