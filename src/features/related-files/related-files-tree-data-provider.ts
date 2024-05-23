import * as vscode from 'vscode'
import * as path from 'path'
import { LRUCache } from 'lru-cache'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { getBasename } from './get-basename'
import { getRelatedFilesQueries } from './get-related-files-queries'

export class RelatedFilesTreeDataProvider implements vscode.TreeDataProvider<RelatedFileTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  private _useRelativePaths = false
  private _useExcludes = false
  private _excludePattern: string | undefined
  private _cache = new LRUCache<string, RelatedFileTreeItem[]>({ max: 100 })

  setUseRelativePaths(value: boolean) {
    this._useRelativePaths = value
  }

  setUseExcludes(value: boolean) {
    this._useExcludes = value
  }

  refresh(): void {
    // TODO: generate this outside of the data provider and pass it here instead
    if (this._useExcludes) {
      const searchExcludes = vscode.workspace.getConfiguration('search').get<Record<string, unknown>>('exclude')
      const customExcludes = vscode.workspace.getConfiguration('streamline').get<Record<string, unknown>>('relatedFiles.exclude')

      const excludeEntries = Object.entries({ ...searchExcludes, ...customExcludes })
      this._excludePattern = excludeEntries.length > 0
        ? `{${excludeEntries.filter(([_, value]) => value === true).map(([key]) => key).join(',')}}`
        : undefined
    } else {
      this._excludePattern = undefined
    }

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
    const workspaceFolder = isMultiRootWorkspace() ? vscode.workspace.getWorkspaceFolder(currentUri) : undefined

    const relatedFilesQueries = getRelatedFilesQueries(currentUri.path)
    const bestInclude = workspaceFolder ? new vscode.RelativePattern(workspaceFolder.uri, relatedFilesQueries.best) : relatedFilesQueries.best
    const worstInclude = workspaceFolder ? new vscode.RelativePattern(workspaceFolder.uri, relatedFilesQueries.worst) : relatedFilesQueries.worst

    // TODO: Use findFiles2() when API is stable
    //       See https://github.com/microsoft/vscode/pull/203844
    // TODO: Exclude files from search.exclude and files.exclude configurations
    const [bestMatchedUris, worstMatchedUris] = (
      await Promise.all([
        vscode.workspace.findFiles(bestInclude, this._excludePattern, 10),
        vscode.workspace.findFiles(worstInclude, this._excludePattern, 10),
      ])
    ).map(uris => {
      // Sort files by name to stabilize list order
      uris.sort((a, b) => a.path.localeCompare(b.path))

      // Sort files by distances
      if (this._useRelativePaths) uris.sort((a, b) => a.path.split('/').length - b.path.split('/').length)

      // Sort files by basename equality
      uris.sort((a, b) => {
        const basenameA = getBasename(a.path)
        const basenameB = getBasename(b.path)

        if (basenameA === currentBasename && basenameB === currentBasename) return 0
        if (basenameA !== currentBasename && basenameB !== currentBasename) return 0
        return basenameA === currentBasename ? -1 : 1
      })

      return uris
    })

    const children: RelatedFileTreeItem[] = []
    const ignoredPaths = new Set([currentUri.path])

    for (const relatedUri of bestMatchedUris) {
      if (ignoredPaths.has(relatedUri.path)) continue
      ignoredPaths.add(relatedUri.path)
      children.push(this.createRelatedFileTreeItem(currentUri, relatedUri, getBasename(relatedUri.path) === currentBasename))
    }

    for (const relatedUri of worstMatchedUris) {
      if (ignoredPaths.has(relatedUri.path)) continue
      ignoredPaths.add(relatedUri.path)
      children.push(this.createRelatedFileTreeItem(currentUri, relatedUri))
    }

    this._cache.set(currentUri.path, children)
    return children
  }

  createRelatedFileTreeItem(originalUri: vscode.Uri, relatedUri: vscode.Uri, isBestMatch?: boolean) {
    let label: string
    if (this._useRelativePaths) {
      label = path.relative(originalUri.path, relatedUri.path).replace('../', '')
      if (!label.startsWith('../')) label = './' + label
    } else {
      label = vscode.workspace.asRelativePath(relatedUri)
    }

    return new RelatedFileTreeItem(label, relatedUri, isBestMatch)
  }
}

export class RelatedFileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly uri: vscode.Uri,
    public readonly isBestMatch?: boolean,
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
