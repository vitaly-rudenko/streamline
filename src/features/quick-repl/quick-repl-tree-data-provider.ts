import * as vscode from 'vscode'
import * as os from 'os'
import { QuickReplConfig } from './quick-repl-config'
import { replaceHomeWithShorthand, replaceShorthandWithHomedir } from './quick-repl-feature'
import { ConditionContext, testWhen } from '../../common/when'

type TreeItem = FolderTreeItem | FileTreeItem | MissingFolderTreeItem

export class QuickReplTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  constructor(
    private readonly config: QuickReplConfig,
    private readonly generateConditionContextForPath: (path: string) => ConditionContext
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
      directoryUri = vscode.Uri.file(replaceShorthandWithHomedir(this.config.getReplsPath()))
    }

    if (element instanceof FolderTreeItem) {
      directoryUri = element.uri
    }

    if (directoryUri) {
      let files: [string, vscode.FileType][]
      try {
        files = await vscode.workspace.fs.readDirectory(directoryUri)
      } catch (error) {
        console.warn('[QuickRepl] Could not read directory', directoryUri, error)
        return [new MissingFolderTreeItem(directoryUri)]
      }

      if (element === undefined && files.length === 0) {
        return [new EmptyFolderTreeItem(directoryUri)]
      }

      // sort by name, folders first
      files.sort((a, b) => {
        if (a[1] === b[1]) return a[0].localeCompare(b[0])
        return a[1] === vscode.FileType.Directory ? -1 : 1
      })

      return files
        .filter(([_, fileType]) => fileType === vscode.FileType.Directory || fileType === vscode.FileType.File)
        .filter(([filename]) => !filename.startsWith('.')) // Exclude hidden files
        .map(([filename, fileType]) => {
          const fileUri = vscode.Uri.joinPath(directoryUri, filename)

          const conditionContext = this.generateConditionContextForPath(fileUri.path)
          const isRunnable = this.config.getCommands().some(command => !command.when || testWhen(conditionContext, command.when))

          return fileType === vscode.FileType.Directory
            ? new FolderTreeItem(filename, isRunnable, fileUri)
            : new FileTreeItem(filename, isRunnable, fileUri)
        })
    }

    return undefined
  }
}

export class FolderTreeItem extends vscode.TreeItem {
  constructor(label: string, public readonly isRunnable: boolean, public readonly uri: vscode.Uri) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed)

    this.iconPath = vscode.ThemeIcon.Folder
    this.resourceUri = uri
    this.contextValue = isRunnable ? 'runnableFolder' : 'folder'
    this.tooltip = uri.path
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(label: string, public readonly isRunnable: boolean, public readonly uri: vscode.Uri) {
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

export class MissingFolderTreeItem extends vscode.TreeItem {
  constructor(uri: vscode.Uri) {
    super(
      `Folder does not exist: ${replaceHomeWithShorthand(uri.path)}`,
      vscode.TreeItemCollapsibleState.None
    )

    this.iconPath = new vscode.ThemeIcon('error')
    this.contextValue = 'missingFolder'
  }
}

export class EmptyFolderTreeItem extends vscode.TreeItem {
  constructor(uri: vscode.Uri) {
    super(
      `Folder is empty: ${replaceHomeWithShorthand(uri.path)}`,
      vscode.TreeItemCollapsibleState.None
    )

    this.iconPath = new vscode.ThemeIcon('folder-opened')
    this.contextValue = 'emptyFolder'
  }
}
