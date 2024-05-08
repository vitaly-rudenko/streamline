import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { getPathQuery } from './get-path-query'

export async function createRelatedFilesFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

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
}
