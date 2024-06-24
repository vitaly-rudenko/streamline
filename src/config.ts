import * as vscode from 'vscode'

export function getConfig() {
  return vscode.workspace.getConfiguration('streamline')
}

export const initialConfig = getConfig()
