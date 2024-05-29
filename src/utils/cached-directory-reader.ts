import * as vscode from 'vscode'
import { pathToUri } from './uri'

export class CachedDirectoryReader {
	private _cache = new Map<string, string[]>()

	async read(path: string): Promise<string[]> {
		const cached = this._cache.get(path)
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

		this._cache.set(path, results)
		return results
	}

	clearCache() {
		this._cache.clear()
	}
}
