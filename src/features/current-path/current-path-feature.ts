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
    updateCurrentPathStatusBarItem()
    updateCurrentSelectionStatusBarItem()
  }, 500)

  const currentPathStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  currentPathStatusBarItem.name = 'Current Path'
  currentPathStatusBarItem.command = 'streamline.currentPath.copy'
  context.subscriptions.push(currentPathStatusBarItem)

  const currentSelectionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99)
  currentSelectionStatusBarItem.name = 'Current Selection'
  context.subscriptions.push(currentSelectionStatusBarItem)

  function updateCurrentPathStatusBarItem() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (activeTextEditor) {
      const path = vscode.workspace.asRelativePath(activeTextEditor.document.uri.path)
      currentPathStatusBarItem.text = collapseString(path, basename(path, extname(path)), config.getMaxLabelLength(), config.getCollapsedIndicator())
      currentPathStatusBarItem.show()
    } else {
      currentPathStatusBarItem.hide()
    }
  }

  function updateCurrentSelectionStatusBarItem() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (activeTextEditor) {
      if (activeTextEditor.selection.isEmpty) {
        currentSelectionStatusBarItem.text = `${activeTextEditor.selection.start.line}:${activeTextEditor.selection.start.character}`
      } else {
        const stats = activeTextEditor.selection.isSingleLine
          ? `${activeTextEditor.selection.end.character - activeTextEditor.selection.start.character}C`
          : `${activeTextEditor.selection.end.line - activeTextEditor.selection.start.line + 1}L ${activeTextEditor.document.getText(activeTextEditor.selection).length}C`

        if (activeTextEditor.selection.isSingleLine) {
          currentSelectionStatusBarItem.text = `${activeTextEditor.selection.start.line}:${activeTextEditor.selection.start.character}-${activeTextEditor.selection.end.character} (${stats})`
        } else {
          currentSelectionStatusBarItem.text = `${activeTextEditor.selection.start.line}:${activeTextEditor.selection.start.character}-${activeTextEditor.selection.end.line}:${activeTextEditor.selection.end.character} (${stats})`
        }
      }

      currentSelectionStatusBarItem.show()
    } else {
      currentPathStatusBarItem.hide()
    }
  }

  // Copy currently opened file's absolute path
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.currentPath.copy', async () => {
      const activeTextEditor = vscode.window.activeTextEditor
      if (!activeTextEditor) return

      await vscode.env.clipboard.writeText(activeTextEditor.document.uri.path)

      const copiedMessage = '⸱⸱⸱ copied!'
      currentPathStatusBarItem.text = currentPathStatusBarItem.text.length > copiedMessage.length
        ? currentPathStatusBarItem.text.slice(0, -copiedMessage.length) + copiedMessage
        : copiedMessage

      setTimeout(() => updateCurrentPathStatusBarItem(), 1000)
    })
  )

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateCurrentPathStatusBarItem()),
    vscode.window.onDidChangeTextEditorSelection(() => updateCurrentSelectionStatusBarItem()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.currentPath')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    }),
  )

  updateCurrentPathStatusBarItem()
  updateCurrentSelectionStatusBarItem()
}
