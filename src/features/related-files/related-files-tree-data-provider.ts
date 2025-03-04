import * as vscode from 'vscode'
import { LRUCache } from 'lru-cache'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import type { RelatedFilesConfig } from './related-files-config'
import { RelatedFile, RelatedFilesFinder } from './related-files-finder'

export class RelatedFilesTreeDataProvider implements vscode.TreeDataProvider<RelatedFileTreeItem | WorkspaceFolderTreeItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  // Cache related files in memory for recently opened files
  private readonly _cache = new LRUCache<string, (RelatedFileTreeItem | WorkspaceFolderTreeItem)[]>({ max: 100 })

  constructor(
    private readonly config: RelatedFilesConfig,
    private readonly relatedFilesFinder: RelatedFilesFinder
  ) {}

  refresh(): void {
		this._onDidChangeTreeData.fire()
	}

  clearCacheAndRefresh(): void {
    this._cache.clear()
    this.refresh()
  }

  getTreeItem(element: RelatedFileTreeItem | WorkspaceFolderTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  async getChildren(element?: WorkspaceFolderTreeItem | RelatedFileTreeItem): Promise<(RelatedFileTreeItem | WorkspaceFolderTreeItem)[] | undefined> {
    const currentUri = vscode.window.activeTextEditor?.document.uri
    if (!currentUri) return

    if (element instanceof WorkspaceFolderTreeItem) {
      return element.children
    }

    // There are no children for RelatedFile items
    if (element) return

    const cache = this._cache.get(currentUri.path)
    if (cache) return cache

    let children: (WorkspaceFolderTreeItem | RelatedFileTreeItem)[] = []

    const currentUriWorkspaceFolder = vscode.workspace.getWorkspaceFolder(currentUri)
    if (isMultiRootWorkspace() && this.config.getUseGlobalSearch()) { // Search in all workspace folders
      const sortedWorkspaceFolders = [
        currentUriWorkspaceFolder,
        ...(vscode.workspace.workspaceFolders ?? [])
          .filter(workspaceFolder => workspaceFolder.name !== currentUriWorkspaceFolder?.name)
          .sort((a, b) => a.index - b.index),
      ]
        .filter((workspaceFolder) => workspaceFolder !== undefined)
        .filter((workspaceFolder) => (
          workspaceFolder.name === currentUriWorkspaceFolder?.name ||
          !this.config.getHiddenWorkspaceFoldersInGlobalSearch().includes(workspaceFolder.name)
        ))

      const workspaceFolderChildrenList = await Promise.all(
        sortedWorkspaceFolders.map(async (workspaceFolder) => [
          workspaceFolder,
          (await this.relatedFilesFinder.find(currentUri, workspaceFolder)).map(createRelatedFileTreeItem)
        ] as const)
      )

      children = workspaceFolderChildrenList
        .filter(([_workspaceFolder, children]) => children.length > 0)
        .map(([workspaceFolder, children]) => new WorkspaceFolderTreeItem(workspaceFolder, children))
    } else { // Or only in current file's workspace folder
      children = (await this.relatedFilesFinder.find(currentUri, currentUriWorkspaceFolder)).map(createRelatedFileTreeItem)
    }

    this._cache.set(currentUri.path, children)
    return children
  }
}

export class WorkspaceFolderTreeItem extends vscode.TreeItem {
  constructor(public readonly workspaceFolder: vscode.WorkspaceFolder, public readonly children: RelatedFileTreeItem[]) {
    super(workspaceFolder.name, vscode.TreeItemCollapsibleState.Expanded)
    this.contextValue = 'workspaceFolder'
  }
}

const bestMatchThemeIcon = new vscode.ThemeIcon('star-full')
export class RelatedFileTreeItem extends vscode.TreeItem {
  constructor(label: string, uri: vscode.Uri, isBestMatch?: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.iconPath = isBestMatch ? bestMatchThemeIcon : undefined
    this.resourceUri = uri
    this.contextValue = 'relatedFile'
    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}

function createRelatedFileTreeItem(relatedFile: RelatedFile): RelatedFileTreeItem {
  return new RelatedFileTreeItem(relatedFile.label, relatedFile.uri, relatedFile.isBestMatch)
}
