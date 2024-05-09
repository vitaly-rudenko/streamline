import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { RelatedFilesTreeDataProvider } from './related-files-tree-data-provider'
import { getPathQuery } from './get-path-query'

export async function createRelatedFilesFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const relatedFilesTreeDataProvider = new RelatedFilesTreeDataProvider()
	vscode.window.registerTreeDataProvider('relatedFiles', relatedFilesTreeDataProvider)

  async function refresh() {
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
    vscode.window.onDidChangeActiveTextEditor(() => {
      relatedFilesTreeDataProvider.refresh()
    })
    vscode.workspace.onDidCreateFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
    vscode.workspace.onDidDeleteFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
    vscode.workspace.onDidRenameFiles(() => relatedFilesTreeDataProvider.clearCacheAndRefresh()),
  )

  return { refresh }
}
