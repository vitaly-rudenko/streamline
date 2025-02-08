import * as vscode from 'vscode'
import * as os from 'os'

type TreeItem = FolderTreeItem | FileTreeItem

export class QuickReplTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  refresh(): void {
		this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: TreeItem) {
    return element
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[] | undefined> {
    let directoryUri: vscode.Uri | undefined

    if (element === undefined) {
      const home = os.homedir()
      const directoryPath = `${home}/.streamline/quick-repl/repls`
      directoryUri = vscode.Uri.file(directoryPath)
    }

    if (element instanceof FolderTreeItem) {
      directoryUri = element.uri
    }

    if (directoryUri) {
      const files = await vscode.workspace.fs.readDirectory(directoryUri)

      // sort by name, folders first
      files.sort((a, b) => {
        if (a[1] === b[1]) return a[0].localeCompare(b[0])
        return a[1] === vscode.FileType.Directory ? -1 : 1
      })

      return files
        .filter(([_, fileType]) => fileType === vscode.FileType.Directory || fileType === vscode.FileType.File)
        .filter(([filename]) => !filename.startsWith('.'))
        .map(([filename, fileType]) => {
          const fileUri = vscode.Uri.joinPath(directoryUri, filename)
          return fileType === vscode.FileType.Directory
            ? new FolderTreeItem(filename, fileUri)
            : new FileTreeItem(filename, fileUri)
        })
    }

    return undefined
  }
}

export class FolderTreeItem extends vscode.TreeItem {
  constructor(label: string, public readonly uri: vscode.Uri) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed)

    this.iconPath = vscode.ThemeIcon.Folder
    this.resourceUri = uri
    this.contextValue = 'folder'
    this.tooltip = uri.path
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(label: string, public readonly uri: vscode.Uri) {
    super(label, vscode.TreeItemCollapsibleState.None)

    this.iconPath = vscode.ThemeIcon.File
    this.resourceUri = uri
    this.contextValue = 'file'
    this.tooltip = uri.path

    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}
