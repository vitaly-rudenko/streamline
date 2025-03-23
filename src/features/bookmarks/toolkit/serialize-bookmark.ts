import { Bookmark, SerializedBookmark } from '../common'
import { serializeSelection } from '../../../utils/serialize-selection'

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