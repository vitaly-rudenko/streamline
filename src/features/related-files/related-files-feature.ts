import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { RelatedFilesTreeDataProvider, type RelatedFileTreeItem } from './related-files-tree-data-provider'
import { getRelatedFilesQueries } from './get-related-files-queries'
import { config } from '../../config'

export function createRelatedFilesFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const useRelativePaths = config.get<boolean>('relatedFiles.useRelativePaths', true)
  const useExcludes = config.get<boolean>('relatedFiles.useExcludes', true)

  const relatedFilesTreeDataProvider = new RelatedFilesTreeDataProvider()
  relatedFilesTreeDataProvider.useRelativePaths = useRelativePaths
  relatedFilesTreeDataProvider.useExcludes = useExcludes

	context.subscriptions.push(vscode.window.registerTreeDataProvider('relatedFiles', relatedFilesTreeDataProvider))

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
      relatedFilesTreeDataProvider.clearCacheAndRefresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.toggleUseRelativePaths', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const useRelativePaths = config.get<boolean>('relatedFiles.useRelativePaths', true)

      relatedFilesTreeDataProvider.useRelativePaths = !useRelativePaths
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      await config.update('relatedFiles.useRelativePaths', !useRelativePaths)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.toggleUseExcludes', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const useExcludes = config.get<boolean>('relatedFiles.useExcludes', true)

      relatedFilesTreeDataProvider.useExcludes = !useExcludes
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
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('search.exclude') || event.affectsConfiguration('files.exclude')) {
        relatedFilesTreeDataProvider.clearCacheAndRefresh()
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => relatedFilesTreeDataProvider.refresh()),
    vscode.workspace.onDidCreateFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
    vscode.workspace.onDidDeleteFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
    vscode.workspace.onDidRenameFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
  )
}
