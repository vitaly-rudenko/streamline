import * as vscode from 'vscode'
import path from 'path'
import { TreeItem } from 'vscode'
import { QuickReplConfig } from './quick-repl-config'
import { QuickReplTreeDataProvider, FileTreeItem, FolderTreeItem } from './quick-repl-tree-data-provider'

export class QuickReplDragAndDropController implements vscode.TreeDragAndDropController<TreeItem> {
  dropMimeTypes = ['application/vnd.code.tree.quickrepl']
  dragMimeTypes = []

  constructor(
    private readonly config: QuickReplConfig,
    private readonly treeDataProvider: QuickReplTreeDataProvider,
  ) {}

  async handleDrag(source: TreeItem[], treeDataTransfer: vscode.DataTransfer): Promise<void> {
    const movableTreeItems = source.filter(item => item instanceof FileTreeItem || item instanceof FolderTreeItem)
    if (movableTreeItems.length > 0) {
      treeDataTransfer.set(
        'application/vnd.code.tree.quickrepl',
        new vscode.DataTransferItem(movableTreeItems.map(item => item.uri)),
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
      if (this.config.getDynamicAdditionalReplsUris().length === 0) {
        destinationDirectoryUri = this.config.getDynamicReplsUri()
      }
    }
    if (!destinationDirectoryUri) return

    const targetUris: vscode.Uri[] = dataTransfer.get('application/vnd.code.tree.quickrepl')?.value
    if (!targetUris) return

    for (const targetUri of targetUris) {
      const destinationUri = vscode.Uri.joinPath(destinationDirectoryUri, path.basename(targetUri.path))
      await vscode.workspace.fs.rename(targetUri, destinationUri)
      if (token.isCancellationRequested) break
    }

    this.treeDataProvider.refresh()
  }
}