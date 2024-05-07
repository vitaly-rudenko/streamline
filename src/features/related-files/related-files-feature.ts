import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'

export async function createRelatedFilesFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quick-open-related-files', async (uri: vscode.Uri | undefined) => {
      uri ||= vscode.window.activeTextEditor?.document.uri
      if (!uri) return

      const filename = uri.path.replace(/\..+$/, '').replace(/^.+\//, '')
      if (!filename) return

      const workspaceFolder = isMultiRootWorkspace() ? vscode.workspace.workspaceFolders?.[0] : undefined

      await vscode.commands.executeCommand('workbench.action.quickOpen', workspaceFolder ? `${workspaceFolder.name}/${filename}` : filename)
    })
  )
}
