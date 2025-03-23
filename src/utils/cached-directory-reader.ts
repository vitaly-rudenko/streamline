import * as vscode from 'vscode'
import { pathToUri } from './path-to-uri'
import type { DirectoryReader } from './directory-reader'

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
		if (path === '') throw new Error('Empty path is provided')

		const cached = this._cache.get(path)
		if (cached) return cached

		let results: string[] = []

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

		this._cache.set(path, results)
		return results
	}

	clearCache() {
		this._cache.clear()
	}
}
