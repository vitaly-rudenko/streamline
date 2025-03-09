import * as vscode from 'vscode'
import { LRUCache } from 'lru-cache'
import { formatPaths } from '../../utils/format-paths'
import { generateRelatedFilesGlobs } from './toolkit/generate-related-files-globs'
import { RelatedFilesConfig } from './related-files-config'

export type RelatedFile = {
  uri: vscode.Uri
  label: string
}

export class RelatedFilesFinder {
  // Cache related files in memory for recently opened files
  private readonly _cache = new LRUCache<string, RelatedFile[]>({ max: 100 })
  private readonly _pAll = import('p-all').then((pAll) => pAll.default)

  constructor(private readonly config: RelatedFilesConfig) {}

  async find(currentUri: vscode.Uri, workspaceFolder?: vscode.WorkspaceFolder, options?: { ignoreCache?: boolean }): Promise<RelatedFile[]> {
    const cacheKey = `${workspaceFolder?.name ?? '#'}_${currentUri.path}`
    const cached = this._cache.get(cacheKey)
    if (!options?.ignoreCache && cached) return cached

    const relativePath = vscode.workspace.asRelativePath(currentUri, false)
    const relatedFilesQueries = generateRelatedFilesGlobs(relativePath)

    // Limit search to workspace folder when provided
    const includes = workspaceFolder
      ? relatedFilesQueries.map(query => new vscode.RelativePattern(workspaceFolder.uri, query))
      : [...relatedFilesQueries]

    // TODO: Use findFiles2() when API is stable
    //       See https://github.com/microsoft/vscode/pull/203844
    const pAll = await this._pAll
    const excludePattern = this.generateExcludePattern()
    const matchedUrisPerQuery = (
      await pAll(
        includes.map(include => () => vscode.workspace.findFiles(include, excludePattern, 10)),
        { concurrency: 6 }
      )
    )

    const relatedFiles: RelatedFile[] = []
    const ignoredPaths = new Set([currentUri.path])

    const uris = matchedUrisPerQuery.flat()
    const pathLabels: Map<string, string> = new Map(
      uris.map((uri) => [uri.path, vscode.workspace.asRelativePath(uri, false)])
    )

    // Format all paths beforehand
    const formattedPaths = formatPaths([...pathLabels.values()])
    for (const [path, label] of pathLabels) {
      pathLabels.set(path, formattedPaths.get(label)!)
    }

    for (const uri of matchedUrisPerQuery.flat()) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)
      relatedFiles.push({ label: pathLabels.get(uri.path)!, uri })
    }

    this._cache.set(cacheKey, relatedFiles)
    return relatedFiles
  }

  clearCache() {
    this._cache.clear()
  }

  private generateExcludePattern() {
    const searchExcludes = vscode.workspace.getConfiguration('search').get<Record<string, unknown>>('exclude')
    const excludeEntries = Object.entries({
      ...searchExcludes,
      ...this.config.getCustomExcludes(),
    })

    return excludeEntries.length > 0
      ? `{${excludeEntries.filter(([_, value]) => value === true).map(([key]) => key).join(',')}}`
      : undefined
  }
}
