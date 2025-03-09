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
