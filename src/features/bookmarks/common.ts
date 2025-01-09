import type * as vscode from 'vscode'
import z from 'zod'

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

export const serializedBookmarkSchema = z.object({
  uri: z.string(),
  list: z.string(),
  note: z.string().optional().nullable(),
}).and(z.discriminatedUnion('type', [
  z.object({ type: z.literal('folder') }),
  z.object({ type: z.literal('file') }),
  z.object({ type: z.literal('selection'), selection: z.string(), value: z.string().optional().nullable() }),
]))

export type SerializedBookmark = z.infer<typeof serializedBookmarkSchema>
