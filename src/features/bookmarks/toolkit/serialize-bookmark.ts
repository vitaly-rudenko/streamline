import { Bookmark, SerializedBookmark } from '../common'

export function serializeBookmark(bookmark: Bookmark): SerializedBookmark {
  return {
    uri: bookmark.uri.path,
    list: bookmark.list,
    ...bookmark.note && { note: bookmark.note },
    ...bookmark.type === 'selection' ? {
      type: bookmark.type,
      value: bookmark.value,
      selection: `${bookmark.selection.anchor.line}:${bookmark.selection.anchor.character}-${bookmark.selection.active.line}:${bookmark.selection.active.character}`
    } : {
      type: bookmark.type,
    }
  }
}