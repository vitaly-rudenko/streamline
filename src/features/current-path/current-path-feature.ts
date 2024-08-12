import * as vscode from 'vscode'

export function createCurrentPathFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  let isVisible = true

  const textStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  textStatusBarItem.command = 'streamline.currentPath.toggleVisibility'
  context.subscriptions.push(textStatusBarItem)

  function updateStatusBarItems() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (activeTextEditor) {
      textStatusBarItem.text = isVisible
        ? vscode.workspace.asRelativePath(activeTextEditor.document.uri.path)
        : '$(eye-closed)'
      textStatusBarItem.show()
    } else {
      textStatusBarItem.hide()
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.currentPath.toggleVisibility', () => {
      isVisible = !isVisible
      updateStatusBarItems()
    })
  )

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateStatusBarItems()
    })
  )

  updateStatusBarItems()
}