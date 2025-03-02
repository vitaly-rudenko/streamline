import type { Selection } from 'vscode'

export function serializeSelection(selection: Selection): string {
  return `${selection.anchor.line}:${selection.anchor.character}-${selection.active.line}:${selection.active.character}`
}
