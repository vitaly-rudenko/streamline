import type * as vscode from 'vscode'

export const defaultCurrentList = 'default'

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
    selection: string
    value: string
  }
)

