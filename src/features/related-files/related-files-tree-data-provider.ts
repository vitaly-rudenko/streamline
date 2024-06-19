import * as vscode from 'vscode'
import * as path from 'path'
import { LRUCache } from 'lru-cache'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { getBasename } from '../../utils/get-basename'
import { getRelatedFilesQueries } from './get-related-files-queries'
import type { RelatedFilesConfig } from './related-files-config'

export class RelatedFilesTreeDataProvider implements vscode.TreeDataProvider<RelatedFileTreeItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  private readonly _cache = new LRUCache<string, RelatedFileTreeItem[]>({ max: 100 })

  constructor(private readonly config: RelatedFilesConfig) {}

  refresh(): void {
		this._onDidChangeTreeData.fire()
	}

  clearCacheAndRefresh(): void {
    this._cache.clear()
    this.refresh()
  }

  getTreeItem(element: RelatedFileTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  async getChildren(element?: unknown): Promise<RelatedFileTreeItem[] | undefined> {
    if (element) return

    const currentUri = vscode.window.activeTextEditor?.document.uri
    if (!currentUri) return

    const cache = this._cache.get(currentUri.path)
    if (cache) return cache

    const currentBasename = getBasename(currentUri.path)
    const workspaceFolder = !this.config.getUseGlobalSearch() && isMultiRootWorkspace()
      ? vscode.workspace.getWorkspaceFolder(currentUri)
      : undefined

    const relatedFilesQueries = getRelatedFilesQueries(currentUri.path)
    const bestInclude = workspaceFolder ? new vscode.RelativePattern(workspaceFolder.uri, relatedFilesQueries.best) : relatedFilesQueries.best
    const worstInclude = workspaceFolder ? new vscode.RelativePattern(workspaceFolder.uri, relatedFilesQueries.worst) : relatedFilesQueries.worst

    // TODO: Use findFiles2() when API is stable
    //       See https://github.com/microsoft/vscode/pull/203844
    // TODO: Exclude files from search.exclude and files.exclude configurations
    const excludePattern = this._generateExcludePattern()
    const [bestMatchedUris, worstMatchedUris] = (
      await Promise.all([
        vscode.workspace.findFiles(bestInclude, excludePattern, 10),
        vscode.workspace.findFiles(worstInclude, excludePattern, 10),
      ])
    ).map(uris => {
      // Sort files by name to stabilize list order
      uris.sort((a, b) => a.path.localeCompare(b.path))

      // Sort files by distance
      if (this.config.getUseRelativePaths()) {
        uris.sort((a, b) => a.path.split('/').length - b.path.split('/').length)
      }

      // Sort files by basename equality
      uris.sort((a, b) => {
        const basenameA = getBasename(a.path)
        const basenameB = getBasename(b.path)
        if (basenameA === currentBasename && basenameB !== currentBasename) return -1
        if (basenameA !== currentBasename && basenameB === currentBasename) return 1
        return 0
      })

      return uris
    })

    const children: RelatedFileTreeItem[] = []
    const ignoredPaths = new Set([currentUri.path])

    for (const relatedUri of bestMatchedUris) {
      if (ignoredPaths.has(relatedUri.path)) continue
      ignoredPaths.add(relatedUri.path)
      children.push(this._createRelatedFileTreeItem(currentUri, relatedUri, getBasename(relatedUri.path) === currentBasename))
    }

    for (const relatedUri of worstMatchedUris) {
      if (ignoredPaths.has(relatedUri.path)) continue
      ignoredPaths.add(relatedUri.path)
      children.push(this._createRelatedFileTreeItem(currentUri, relatedUri))
    }

    this._cache.set(currentUri.path, children)
    return children
  }

  private _createRelatedFileTreeItem(originalUri: vscode.Uri, relatedUri: vscode.Uri, isBestMatch?: boolean) {
    let label: string
    if (this.config.getUseRelativePaths()) {
      label = path.relative(originalUri.path, relatedUri.path).replace('../', '')
      if (!label.startsWith('../')) label = './' + label
    } else {
      label = vscode.workspace.asRelativePath(relatedUri)
    }

    return new RelatedFileTreeItem(label, relatedUri, label, isBestMatch)
  }

  // TODO: Does not belong here? Also we do not need to regenerate it every time.
  private _generateExcludePattern() {
    const searchExcludes = vscode.workspace.getConfiguration('search').get<Record<string, unknown>>('exclude')
    const excludeEntries = Object.entries({ ...searchExcludes, ...this.config.getCustomExcludes() })

    return excludeEntries.length > 0
      ? `{${excludeEntries.filter(([_, value]) => value === true).map(([key]) => key).join(',')}}`
      : undefined
  }
}

export class RelatedFileTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    uri: vscode.Uri,
    public readonly textToCopy: string,
    isBestMatch?: boolean,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.iconPath = isBestMatch ? new vscode.ThemeIcon('star-full') : undefined
    this.resourceUri = uri
    this.contextValue = 'relatedFile'
    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}
