import { Uri, WorkspaceFolder } from 'vscode'


export function createScopedUriToPath(currentWorkspaceFolders: WorkspaceFolder[]) {
  return (uri: Uri) => {
    const exactWorkspaceFolder = currentWorkspaceFolders.find(wf => wf.uri.path === uri.path)
    if (exactWorkspaceFolder) return exactWorkspaceFolder.name

    const workspaceFolder = currentWorkspaceFolders.find(wf => uri.path.startsWith(wf.uri.path + '/'))
    if (!workspaceFolder) return undefined

    return workspaceFolder.name + uri.path.slice(workspaceFolder.uri.path.length)
  }
}
