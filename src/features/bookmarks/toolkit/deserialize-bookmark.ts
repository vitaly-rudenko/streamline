import * as vscode from 'vscode'
import { SerializedBookmark, Bookmark } from '../common'

export function deserializeBookmark(serializedBookmark: SerializedBookmark): Bookmark {
  return {
    uri: vscode.Uri.file(serializedBookmark.uri),
    list: serializedBookmark.list,
    ...serializedBookmark.note && { note: serializedBookmark.note },
    ...serializedBookmark.type === 'selection' ? {
      type: serializedBookmark.type,
      value: serializedBookmark.value || '',
      selection: parseSelection(serializedBookmark.selection),
    } : {
      type: serializedBookmark.type,
    }
  }
}

function parseSelection(serializedSelection: Extract<SerializedBookmark, { type: 'selection' }>['selection']): vscode.Selection {
  const [anchorLine, anchorCharacter, activeLine, activeCharacter] = serializedSelection.split(/:|-/).map(Number)
  return new vscode.Selection(anchorLine, anchorCharacter, activeLine, activeCharacter)
}
