import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { RelatedFilesTreeDataProvider, type RelatedFileTreeItem } from './related-files-tree-data-provider'
import { getRelatedFilesQueries } from './get-related-files-queries'

export async function createRelatedFilesFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const relatedFilesTreeDataProvider = new RelatedFilesTreeDataProvider()
	context.subscriptions.push(
    vscode.window.registerTreeDataProvider('relatedFiles', relatedFilesTreeDataProvider)
  )

  async function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')
    const useRelativePaths = config.get<boolean>('relatedFiles.useRelativePaths', true)
    const useExcludes = config.get<boolean>('relatedFiles.useExcludes', true)

    relatedFilesTreeDataProvider.setUseRelativePaths(useRelativePaths)
    relatedFilesTreeDataProvider.setUseExcludes(useExcludes)
    relatedFilesTreeDataProvider.clearCacheAndRefresh()
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.quickOpen', async (uri: vscode.Uri | undefined) => {
      uri ||= vscode.window.activeTextEditor?.document.uri
      if (!uri) return

      const relatedFilesQueries = getRelatedFilesQueries(uri.path)
      const workspaceFolder = isMultiRootWorkspace() ? vscode.workspace.getWorkspaceFolder(uri) : undefined
      const query = workspaceFolder ? `${workspaceFolder.name}/${relatedFilesQueries.worst}` : relatedFilesQueries.worst

      await vscode.commands.executeCommand('workbench.action.quickOpen', query)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.refresh', async () => {
      await refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.toggleUseRelativePaths', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const useRelativePaths = config.get<boolean>('relatedFiles.useRelativePaths', true)

      relatedFilesTreeDataProvider.setUseRelativePaths(!useRelativePaths)
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      await config.update('relatedFiles.useRelativePaths', !useRelativePaths)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.toggleUseExcludes', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const useExcludes = config.get<boolean>('relatedFiles.useExcludes', true)

      relatedFilesTreeDataProvider.setUseExcludes(!useExcludes)
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      await config.update('relatedFiles.useExcludes', !useExcludes)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.copyPath', async (relatedFileTreeItem: RelatedFileTreeItem) => {
      await vscode.env.clipboard.writeText(relatedFileTreeItem.label)
    })
  )

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => relatedFilesTreeDataProvider.refresh()),
    vscode.workspace.onDidCreateFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
    vscode.workspace.onDidDeleteFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
    vscode.workspace.onDidRenameFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
  )

  return { refresh }
}
