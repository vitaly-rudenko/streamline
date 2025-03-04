import * as vscode from 'vscode'
import path from 'path'
import { TreeItem } from 'vscode'
import { QuickReplConfig } from './quick-repl-config'
import { QuickReplTreeDataProvider, FileTreeItem, FolderTreeItem } from './quick-repl-tree-data-provider'
import { expandHomedir } from '../../utils/expand-homedir'

export class QuickReplDragAndDropController implements vscode.TreeDragAndDropController<TreeItem> {
  // MIMEs for dropping items into Quick Repl view
  dropMimeTypes = ['text/uri-list']

  // MIMEs for dragging items from Quick Repl view (e.g. into explorer, editor or into Quick Repl view itself)
  dragMimeTypes = ['text/uri-list']

  constructor(
    private readonly config: QuickReplConfig,
    private readonly treeDataProvider: QuickReplTreeDataProvider,
    private readonly homedir: string,
  ) {}

  async handleDrag(source: TreeItem[], treeDataTransfer: vscode.DataTransfer): Promise<void> {
    const movableTreeItems = source.filter(item => item instanceof FileTreeItem || item instanceof FolderTreeItem)
    if (movableTreeItems.length > 0) {
      treeDataTransfer.set(
        'text/uri-list',
        new vscode.DataTransferItem(movableTreeItems.map(item => item.uri.toString()).join('\r\n')),
      )
    }
  }

  async handleDrop(destination: unknown, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
    let destinationDirectoryUri: vscode.Uri | undefined
    if (destination instanceof FolderTreeItem) {
      destinationDirectoryUri = destination.uri
    } else if (destination instanceof FileTreeItem) {
      destinationDirectoryUri = vscode.Uri.file(path.dirname(destination.uri.path))
    } else if (destination === undefined) {
      const shortReplsPath = this.config.getShortReplsPath()
      if (shortReplsPath) {
        destinationDirectoryUri = vscode.Uri.file(
          expandHomedir(shortReplsPath, this.homedir)
        )
      }
    }
    if (!destinationDirectoryUri) return

    const uriList = dataTransfer.get('text/uri-list')?.value as string | undefined
    if (!uriList) return

    const targetUris = uriList.split(/[\r\n]+/g).filter(Boolean).map(p => vscode.Uri.parse(p))
    for (const targetUri of targetUris) {
      const destinationUri = vscode.Uri.joinPath(destinationDirectoryUri, path.basename(targetUri.path))
      await vscode.workspace.fs.rename(targetUri, destinationUri)
      if (token.isCancellationRequested) break
    }

    this.treeDataProvider.refresh()
  }
}