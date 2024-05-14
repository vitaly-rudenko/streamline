import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { RelatedFilesTreeDataProvider, type RelatedFileTreeItem } from './related-files-tree-data-provider'
import { getPathQuery } from './get-path-query'

export async function createRelatedFilesFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const relatedFilesTreeDataProvider = new RelatedFilesTreeDataProvider()
	vscode.window.registerTreeDataProvider('relatedFiles', relatedFilesTreeDataProvider)

  async function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')
    const useRelativePathsInRelatedFiles = config.get<boolean>('useRelativePathsInRelatedFiles', true)
    const useExcludesInRelatedFiles = config.get<boolean>('useExcludesInRelatedFiles', true)

    relatedFilesTreeDataProvider.setUseRelativePaths(useRelativePathsInRelatedFiles)
    relatedFilesTreeDataProvider.setUseExcludes(useExcludesInRelatedFiles)
    relatedFilesTreeDataProvider.clearCacheAndRefresh()
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quick-open-related-files', async (uri: vscode.Uri | undefined) => {
      uri ||= vscode.window.activeTextEditor?.document.uri
      if (!uri) return

      const pathQuery = getPathQuery(uri.path, { includeSingleFolder: false })
      if (!pathQuery) return

      const workspaceFolder = isMultiRootWorkspace() ? vscode.workspace.getWorkspaceFolder(uri) : undefined

      await vscode.commands.executeCommand('workbench.action.quickOpen', workspaceFolder ? `${workspaceFolder.name}/${pathQuery}` : pathQuery)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.refresh-related-files', async () => {
      await refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.toggle-use-relative-paths-in-related-files', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const useRelativePathsInRelatedFiles = config.get<boolean>('useRelativePathsInRelatedFiles', true)

      await config.update('useRelativePathsInRelatedFiles', !useRelativePathsInRelatedFiles)
      await refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.toggle-use-excludes-in-related-files', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const useExcludesInRelatedFiles = config.get<boolean>('useExcludesInRelatedFiles', true)

      await config.update('useExcludesInRelatedFiles', !useExcludesInRelatedFiles)
      await refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.copy-related-file-path', async (relatedFileTreeItem: RelatedFileTreeItem) => {
      await vscode.env.clipboard.writeText(relatedFileTreeItem.label)
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        event.affectsConfiguration('streamline.useRelativePathsInRelatedFiles') ||
        event.affectsConfiguration('streamline.useExcludesInRelatedFiles')
      ) {
        await refresh()
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => relatedFilesTreeDataProvider.refresh()),
    vscode.workspace.onDidCreateFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
    vscode.workspace.onDidDeleteFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
    vscode.workspace.onDidRenameFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
  )

  return { refresh }
}
