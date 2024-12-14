import * as vscode from 'vscode'
import { CurrentPathConfig } from './current-path-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { collapseString } from '../../utils/collapse-string'
import { basename, extname } from 'path'

export function createCurrentPathFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new CurrentPathConfig()
  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    updateStatusBarItems()
  }, 500)

  const textStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  textStatusBarItem.command = 'streamline.currentPath.copy'
  context.subscriptions.push(textStatusBarItem)

  function updateStatusBarItems() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (activeTextEditor) {
      const path = vscode.workspace.asRelativePath(activeTextEditor.document.uri.path)
      textStatusBarItem.text = collapseString(path, basename(path, extname(path)), config.getMaxLabelLength(), config.getCollapsedIndicator())
      textStatusBarItem.show()
    } else {
      textStatusBarItem.hide()
    }
  }

  // Copy currently opened file's absolute path
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.currentPath.copy', async () => {
      const activeTextEditor = vscode.window.activeTextEditor
      if (!activeTextEditor) return

      await vscode.env.clipboard.writeText(activeTextEditor.document.uri.path)

      const copiedMessage = '⸱⸱⸱ copied!'
      textStatusBarItem.text = textStatusBarItem.text.length > copiedMessage.length
        ? textStatusBarItem.text.slice(0, -copiedMessage.length) + copiedMessage
        : copiedMessage

      setTimeout(() => updateStatusBarItems(), 1000)
    })
  )

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateStatusBarItems()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.currentPath')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    }),
  )

  updateStatusBarItems()
}
