import * as vscode from 'vscode'

export async function createRelatedFilesFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quick-open-related-files', async (file: vscode.Uri | undefined) => {
      file ||= vscode.window.activeTextEditor?.document.uri
      if (!file) return

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(file)
      const pathWithoutExtension = vscode.workspace.asRelativePath(file).replace(/\..*$/, '')
      const filename = pathWithoutExtension.split('/').at(-1)
      if (!filename) return

      await vscode.commands.executeCommand('workbench.action.quickOpen', workspaceFolder ? `${workspaceFolder.name}/${filename}` : filename)
    })
  )
}
