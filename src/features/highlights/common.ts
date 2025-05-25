import type { Uri, Range } from 'vscode'

export type Highlight = {
  uri: Uri
  range: Range
  type: 'selection' | 'line'
}
