import type { Selection } from 'vscode'
import { Bookmark, SerializedBookmark } from '../common'

export function serializeBookmark(bookmark: Bookmark): SerializedBookmark {
  return {
    uri: bookmark.uri.path,
    list: bookmark.list,
    ...bookmark.note && { note: bookmark.note },
    ...bookmark.type === 'selection' ? {
      type: bookmark.type,
      value: bookmark.value,
      selection: serializeSelection(bookmark.selection)
    } : {
      type: bookmark.type,
    }
  }
}

// TODO: extract into common module
export function serializeSelection(selection: Selection): string {
  return `${selection.anchor.line}:${selection.anchor.character}-${selection.active.line}:${selection.active.character}`
}