import * as vscode from 'vscode'

export function isMultiRootWorkspace() {
  return vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders.length > 1
    : false
}
