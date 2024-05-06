import * as vscode from 'vscode'

export async function readDirectory(path: string): Promise<string[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders
	if (!workspaceFolders) {
		return []
	}

	if (path === '') {
		return workspaceFolders.map(workspaceFolder => workspaceFolder.name + '/')
	} else {
		const rootWorkspaceFolder = workspaceFolders.find(workspaceFolder => path.startsWith(workspaceFolder.name))
		if (!rootWorkspaceFolder) {
			return []
		}

		path = path.slice(rootWorkspaceFolder.name.length + 1)

		const uri = vscode.Uri.joinPath(rootWorkspaceFolder.uri, path.endsWith('/') ? path.slice(0, -1) : path)
		const files = await vscode.workspace.fs.readDirectory(uri)
		return files.map(([name, type]) => `${rootWorkspaceFolder.name}/${path}${name}` + (type === vscode.FileType.Directory ? '/' : ''))
	}
}
