import type * as vscode from 'vscode'

export type Bookmark = {
  uri: vscode.Uri
  list: string
  note?: string
} & (
  { type: 'folder' } |
  { type: 'file' } |
  {
    type: 'selection'
    selection: vscode.Selection
    value: string
  }
)
export type SerializedBookmark = {
  uri: string
  list: string
  note?: string
} & (
  { type: 'folder' } |
  { type: 'file' } |
  {
    type: 'selection'
    selection: {
      anchorLine: number
      anchorCharacter: number
      activeLine: number
      activeCharacter: number
    }
    /** @deprecated Replaced by `value` */
    preview?: string
    value: string;
  }
)
