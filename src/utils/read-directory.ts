import * as vscode from 'vscode'
import { pathToUri } from './uri'

export function createDirectoryReader() {
	const cache = new Map<string, string[]>()

	return async function readDirectory(path: string): Promise<string[]> {
		const cached = cache.get(path)
		if (cached) return cached

		let results: string[]
		if (path !== '') {
			const uri = pathToUri(path)
			if (uri) {
				const files = await vscode.workspace.fs.readDirectory(uri)
				results = files.map(([name]) => `${path}/${name}`)
			} else {
				results = []
			}
		} else {
			results = vscode.workspace.workspaceFolders?.map(workspaceFolder => workspaceFolder.name) ?? []
		}

		cache.set(path, results)
		return results
	}
}
