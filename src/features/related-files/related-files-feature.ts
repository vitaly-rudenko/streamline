import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { RelatedFilesTreeDataProvider, type RelatedFileTreeItem } from './related-files-tree-data-provider'
import { getRelatedFilesQueries } from './get-related-files-queries'
import { RelatedFilesConfig } from './related-files-config'

export function createRelatedFilesFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new RelatedFilesConfig()
  const relatedFilesTreeDataProvider = new RelatedFilesTreeDataProvider(config)

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
    vscode.commands.registerCommand('streamline.relatedFiles.refresh', () => {
      relatedFilesTreeDataProvider.clearCacheAndRefresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.toggleUseRelativePaths', async () => {
      config.useRelativePaths = !config.useRelativePaths
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      await config.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.toggleUseExcludes', async () => {
      config.useExcludes = !config.useExcludes
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      await config.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.copyPath', async (relatedFileTreeItem: RelatedFileTreeItem) => {
      await vscode.env.clipboard.writeText(relatedFileTreeItem.label)
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('search.exclude') ||
        event.affectsConfiguration('files.exclude')
      ) {
        relatedFilesTreeDataProvider.clearCacheAndRefresh()
      }

      if (event.affectsConfiguration('streamline.relatedFiles')) {
        if (config.load()) {
          relatedFilesTreeDataProvider.clearCacheAndRefresh()
        }
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => relatedFilesTreeDataProvider.refresh()),
    vscode.workspace.onDidCreateFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
    vscode.workspace.onDidDeleteFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
    vscode.workspace.onDidRenameFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
  )

  config.load()
}
