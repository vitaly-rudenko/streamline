import * as vscode from 'vscode'
import { QuickReplConfig } from './quick-repl-config'
import { testWhen } from '../../common/when'
import { formatPath } from './utils'
import { GenerateConditionContext } from '../../generate-condition-context'

type TreeItem = FolderTreeItem | FileTreeItem | FailingFolderTreeItem

export class QuickReplTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  constructor(
    private readonly config: QuickReplConfig,
    private readonly generateConditionContext: GenerateConditionContext
  ) {}

  refresh(): void {
		this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: TreeItem) {
    return element
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[] | undefined> {
    let directoryUri: vscode.Uri | undefined

    if (element === undefined) {
      directoryUri = this.config.getDynamicReplsUri()
      if (directoryUri === undefined) {
        return [new SetupTreeItem()]
      }
    }

    if (element instanceof FolderTreeItem) {
      directoryUri = element.uri
    }

    if (directoryUri) {
      let files: [string, vscode.FileType][]
      try {
        files = await vscode.workspace.fs.readDirectory(directoryUri)
      } catch (error: any) {
        console.warn('[QuickRepl] Could not read directory', directoryUri, error)
        return [new FailingFolderTreeItem(directoryUri, error.message)]
      }

      // Placeholder for root folder if empty
      if (element === undefined && files.length === 0) {
        return [new EmptyReplsFolderTreeItem()]
      }

      files = files
        // Exclude symlinks and unknown file types
        .filter(([_, fileType]) => fileType === vscode.FileType.Directory || fileType === vscode.FileType.File)
        // Exclude hidden files
        .filter(([filename]) => !filename.startsWith('.'))
        // Sort by name, folders first
        .sort((a, b) => {
          if (a[1] === b[1]) return a[0].localeCompare(b[0])
          return a[1] === vscode.FileType.Directory ? -1 : 1
        })

      return files
        .map(([filename, fileType]) => {
          const fileUri = vscode.Uri.joinPath(directoryUri, filename)

          const conditionContext = this.generateConditionContext({ path: fileUri.path, fileType })
          const isRunnable = this.config.getCommands().some(command => !command.when || testWhen(conditionContext, command.when))

          return fileType === vscode.FileType.File
            ? new FileTreeItem(filename, isRunnable, fileUri)
            : new FolderTreeItem(filename, isRunnable, fileUri)
        })
    }

    return undefined
  }
}

export class FolderTreeItem extends vscode.TreeItem {
  constructor(label: string, isRunnable: boolean, public readonly uri: vscode.Uri) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed)

    this.iconPath = vscode.ThemeIcon.Folder
    this.resourceUri = uri
    this.contextValue = isRunnable ? 'runnableFolder' : 'folder'
    this.tooltip = uri.path
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(label: string, isRunnable: boolean, public readonly uri: vscode.Uri) {
    super(label, vscode.TreeItemCollapsibleState.None)

    this.iconPath = vscode.ThemeIcon.File
    this.resourceUri = uri
    this.contextValue = isRunnable ? 'runnableFile' : 'file'
    this.tooltip = uri.path

    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}

// Prompt to setup Quick Repl
export class SetupTreeItem extends vscode.TreeItem {
  constructor() {
    super(
      'Click here to setup Quick Repl',
      vscode.TreeItemCollapsibleState.None
    )

    this.iconPath = new vscode.ThemeIcon('rocket')
    this.contextValue = 'setup'

    this.command = {
      command: 'streamline.quickRepl.setup',
      title: 'Setup Quick Repl',
    }
  }
}

// Placeholder for folder that failed to read
export class FailingFolderTreeItem extends vscode.TreeItem {
  constructor(uri: vscode.Uri, errorMessage: string) {
    super(
      `Failed to read folder: ${formatPath(uri.path)}`,
      vscode.TreeItemCollapsibleState.None
    )

    this.tooltip = errorMessage
    this.iconPath = new vscode.ThemeIcon('error')
    this.contextValue = 'failingFolder'
  }
}

// Placeholder for empty root folder
export class EmptyReplsFolderTreeItem extends vscode.TreeItem {
  constructor() {
    super(
      'Click "+" to create your first Quick Repl',
      vscode.TreeItemCollapsibleState.None
    )

    this.iconPath = new vscode.ThemeIcon('question')
    this.contextValue = 'emptyReplsFolder'
  }
}
