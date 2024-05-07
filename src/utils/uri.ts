import * as vscode from 'vscode'

export function pathToUri(path: string): vscode.Uri | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) return undefined

  const exactWorkspaceFolder = workspaceFolders.find(workspaceFolder => path === workspaceFolder.name)
  if (exactWorkspaceFolder) return exactWorkspaceFolder.uri

  const workspaceFolder = workspaceFolders.find(workspaceFolder => path.startsWith(`${workspaceFolder.name}/`))
  if (!workspaceFolder) return undefined

  return vscode.Uri.joinPath(workspaceFolder.uri, path.slice(workspaceFolder.name.length + 1))
}

export function uriToPath(uri: vscode.Uri): string | undefined {
  const exactWorkspaceFolder = vscode.workspace.workspaceFolders?.find(workspaceFolder => workspaceFolder.uri.path === uri.path)
  if (exactWorkspaceFolder) {
    return exactWorkspaceFolder.name
  }

  const path = vscode.workspace.asRelativePath(uri, true)
  // If workspace folder not found, it returns an absolute path
  return path.startsWith('/') ? undefined : path
}
