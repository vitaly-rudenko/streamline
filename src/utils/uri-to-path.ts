import * as vscode from 'vscode'

export function uriToPath(uri: vscode.Uri | undefined): string | undefined {
  if (!uri) return undefined

  const exactWorkspaceFolder = vscode.workspace.workspaceFolders?.find(workspaceFolder => workspaceFolder.uri.path === uri.path)
  if (exactWorkspaceFolder) {
    return exactWorkspaceFolder.name
  }

  const path = vscode.workspace.asRelativePath(uri, true)
  // If workspace folder not found, it returns an absolute path
  return path.startsWith('/') ? undefined : path
}
