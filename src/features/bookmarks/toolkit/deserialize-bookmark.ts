import * as vscode from 'vscode'
import { SerializedBookmark, Bookmark } from '../common'
import { deserializeSelection } from '../../../utils/deserialize-selection'

export function deserializeBookmark(serializedBookmark: SerializedBookmark): Bookmark {
  return {
    uri: vscode.Uri.file(serializedBookmark.uri),
    list: serializedBookmark.list,
    ...serializedBookmark.note && { note: serializedBookmark.note },
    ...serializedBookmark.type === 'selection' ? {
      type: serializedBookmark.type,
      value: serializedBookmark.value || '',
      selection: deserializeSelection(serializedBookmark.selection),
    } : {
      type: serializedBookmark.type,
    }
  }
}
