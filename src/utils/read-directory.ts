import * as vscode from 'vscode'
import { pathToUri } from './uri'

export async function readDirectory(path: string): Promise<string[]> {
	if (path === '') {
		return vscode.workspace.workspaceFolders?.map(workspaceFolder => workspaceFolder.name) ?? []
	}

	const uri = pathToUri(path)
	if (!uri) return []

	const files = await vscode.workspace.fs.readDirectory(uri)
	return files.map(([name]) => `${path}/${name}`)
}
