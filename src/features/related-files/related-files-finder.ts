import * as vscode from 'vscode'
import { LRUCache } from 'lru-cache'
import { collapseString } from '../../utils/collapse-string'
import { formatPaths } from '../../utils/format-paths'
import { getRelatedFilesQueries } from './toolkit/get-related-files-queries'
import { getSmartBasename } from './toolkit/get-smart-basename'
import { RelatedFilesConfig } from './related-files-config'

export type RelatedFile = {
  uri: vscode.Uri
  label: string
  isBestMatch: boolean
}

export class RelatedFilesFinder {
  // Cache related files in memory for recently opened files
  private readonly _cache = new LRUCache<string, RelatedFile[]>({ max: 100 })

  constructor(private readonly config: RelatedFilesConfig) {}

  async find(currentUri: vscode.Uri, workspaceFolder?: vscode.WorkspaceFolder): Promise<RelatedFile[]> {
    const cacheKey = `${workspaceFolder?.name ?? '#'}_${currentUri.path}`
    const cached = this._cache.get(cacheKey)
    if (cached) return cached

    const relativePath = vscode.workspace.asRelativePath(currentUri, false)
    const currentBasename = getSmartBasename(relativePath, this.config.getExcludedSuffixes())

    const relatedFilesQueries = getRelatedFilesQueries(relativePath, this.config.getExcludedSuffixes())

    // Limit search to workspace folder when provided
    const includes = workspaceFolder
      ? relatedFilesQueries.map(query => new vscode.RelativePattern(workspaceFolder.uri, query))
      : [...relatedFilesQueries]

    // TODO: Use findFiles2() when API is stable
    //       See https://github.com/microsoft/vscode/pull/203844
    // TODO: Exclude files from search.exclude and files.exclude configurations
    const excludePattern = this._generateExcludePattern()
    const matchedUrisPerQuery = (
      await Promise.all(
        includes.map(include => vscode.workspace.findFiles(include, excludePattern, 10))
      )
    ).map(uris => {
      // Sort files by name to stabilize list order
      uris.sort((a, b) => a.path.localeCompare(b.path))

      // Sort files by basename equality
      uris.sort((a, b) => {
        const basenameA = getSmartBasename(a.path, this.config.getExcludedSuffixes())
        const basenameB = getSmartBasename(b.path, this.config.getExcludedSuffixes())
        if (basenameA === currentBasename && basenameB !== currentBasename) return -1
        if (basenameA !== currentBasename && basenameB === currentBasename) return 1
        return 0
      })

      return uris
    })

    const relatedFiles: RelatedFile[] = []
    const ignoredPaths = new Set([currentUri.path])

    const uris = matchedUrisPerQuery.flat()
    const pathLabels: Map<string, string> = new Map(
      uris.map((uri) => [uri.path, vscode.workspace.asRelativePath(uri, false)])
    )

    // Format all paths beforehand for efficiency
    const formattedPaths = formatPaths([...pathLabels.values()])
    for (const [path, label] of pathLabels) {
      pathLabels.set(path, formattedPaths.get(label)!)
    }

    // Treat first query in special way ("best match"), and "star" if related file's basename matches current file's one
    for (const uri of matchedUrisPerQuery[0]) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)
      const label = collapseString(pathLabels.get(uri.path)!, currentBasename, this.config.getMaxLabelLength(), this.config.getCollapsedIndicator())
      relatedFiles.push({
        uri,
        label,
        isBestMatch: getSmartBasename(uri.path, this.config.getExcludedSuffixes()) === currentBasename,
      })
    }

    for (const uri of matchedUrisPerQuery.slice(1).flat()) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)
      const label = collapseString(pathLabels.get(uri.path)!, currentBasename, this.config.getMaxLabelLength(), this.config.getCollapsedIndicator())
      relatedFiles.push({ label, uri, isBestMatch: false })
    }

    this._cache.set(cacheKey, relatedFiles)
    return relatedFiles
  }

  clearCache() {
    this._cache.clear()
  }

  // TODO: Does not belong here? Also we do not need to regenerate it every time
  private _generateExcludePattern() {
    const searchExcludes = vscode.workspace.getConfiguration('search').get<Record<string, unknown>>('exclude')
    const excludeEntries = Object.entries({
      ...searchExcludes,
      ...this.config.getUseExcludes() ? this.config.getCustomExcludes() : {},
    })

    return excludeEntries.length > 0
      ? `{${excludeEntries.filter(([_, value]) => value === true).map(([key]) => key).join(',')}}`
      : undefined
  }
}