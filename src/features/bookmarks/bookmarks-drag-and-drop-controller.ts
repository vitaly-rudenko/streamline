import * as vscode from 'vscode'
import { TreeItem, ListTreeItem, FolderTreeItem, FileTreeItem, BookmarksTreeDataProvider } from './bookmarks-tree-data-provider'
import type { BookmarksConfig } from './bookmarks-config'
import { Bookmark } from './common'

export class BookmarksDragAndDropController implements vscode.TreeDragAndDropController<TreeItem> {
  // MIMEs for dropping items into Bookmarks view
  dropMimeTypes = ['text/uri-list']

  // MIMEs for dragging items from Bookmarks view (e.g. into explorer, editor or into Bookmarks view itself)
  dragMimeTypes = ['text/uri-list']

  constructor(
    private readonly config: BookmarksConfig,
    private readonly treeDataProvider: BookmarksTreeDataProvider,
  ) {}

  async handleDrag(source: readonly TreeItem[], treeDataTransfer: vscode.DataTransfer): Promise<void> {
    const movableTreeItems = source.filter(item => item instanceof FileTreeItem || item instanceof FolderTreeItem)
    if (movableTreeItems.length > 0) {
      treeDataTransfer.set('streamline/feature', new vscode.DataTransferItem('bookmarks'))

      treeDataTransfer.set(
        'text/uri-list',
        new vscode.DataTransferItem(movableTreeItems.map(item => item.uri.toString()).join('\r\n')),
      )
    }
  }

  async handleDrop(target: TreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
    const uriList = dataTransfer.get('text/uri-list')?.value as string | undefined
    if (!uriList) return

    // Do not allow drag-n-drop between bookmark lists in bookmarks view
    if (dataTransfer.get('streamline/feature')?.value === 'bookmarks') {
      return
    }

    const targetUris = uriList.split(/[\r\n]+/g).filter(Boolean).map(p => vscode.Uri.parse(p))

    let destinationList: string
    if (target instanceof ListTreeItem || target instanceof FolderTreeItem || target instanceof FileTreeItem) {
      destinationList = target.list
    } else {
      return
    }

    const bookmarks: Bookmark[] = []
    for (const uri of targetUris) {
      try {
        const stat = await vscode.workspace.fs.stat(uri)
        if (token.isCancellationRequested) break

        bookmarks.push({
          uri,
          type: stat.type === vscode.FileType.Directory ? 'folder' : 'file',
          list: destinationList,
        })
      } catch (error) {
        console.warn('[Bookmarks] Could not stat dropped file:', uri.toString(), error)
      }
    }

    this.config.setBookmarks([...this.config.getBookmarks(), ...bookmarks])
    this.treeDataProvider.refresh()

    await this.config.saveInQueue()
  }
}
