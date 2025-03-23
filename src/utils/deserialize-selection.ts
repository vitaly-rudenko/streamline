import * as vscode from 'vscode'

export function deserializeSelection(serializedSelection: string): vscode.Selection {
  const [anchorLine, anchorCharacter, activeLine, activeCharacter] = serializedSelection.split(/:|-/).map(Number)
  return new vscode.Selection(anchorLine, anchorCharacter, activeLine, activeCharacter)
}
