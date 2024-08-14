import * as vscode from 'vscode'
import { pathToUri } from './uri'
import type { DirectoryReader } from './types'

export class CachedDirectoryReader implements DirectoryReader {
	private _cache = new Map<string, string[]>()

	async exists(path: string): Promise<boolean> {
		const uri = pathToUri(path)
		if (!uri) return false

		try {
			await vscode.workspace.fs.stat(uri)
			return true
		} catch (error: any) {
			if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) {
				throw error
			}
		}

		return false
	}

	async read(path: string): Promise<string[]> {
		const cached = this._cache.get(path)
		if (cached) return cached

		let results: string[] = []
		if (path !== '') {
			const uri = pathToUri(path)
			if (uri) {
				try {
					const files = await vscode.workspace.fs.readDirectory(uri)
					results = files.map(([name]) => `${path}/${name}`)
				} catch (error) {
					if (!(error instanceof vscode.FileSystemError && (error.code === 'FileNotADirectory' || error.code === 'FileNotFound'))) {
						throw error
					}
				}
			}
		} else {
			results = (vscode.workspace.workspaceFolders ?? []).map(workspaceFolder => workspaceFolder.name)
		}

		this._cache.set(path, results)
		return results
	}

	clearCache() {
		this._cache.clear()
	}
}
