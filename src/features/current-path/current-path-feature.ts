import * as vscode from 'vscode'
import { CurrentPathConfig } from './current-path-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { collapseString } from '../../utils/collapse-string'
import { basename, extname } from 'path'
import { RegisterCommand } from '../../register-command'

export function createCurrentPathFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
}) {
  const { context, registerCommand } = input

  const config = new CurrentPathConfig()
  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    updateCurrentPathStatusBarItem()
    updateCurrentSelectionStatusBarItem()
  }, 500)

  const currentPathStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999)
  currentPathStatusBarItem.name = 'Current Path'
  currentPathStatusBarItem.command = 'streamline.currentPath.copy'
  context.subscriptions.push(currentPathStatusBarItem)

  const currentSelectionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 999)
  currentSelectionStatusBarItem.name = 'Current Selection'
  context.subscriptions.push(currentSelectionStatusBarItem)

  function updateCurrentPathStatusBarItem() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (activeTextEditor) {
      // Show relative path when possible
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
      const { start, end, isEmpty, isSingleLine } = activeTextEditor.selection

      const tabSize = Number(vscode.workspace.getConfiguration('editor').get('tabSize', 4))

      function line(position: vscode.Position) {
        return position.line + 1
      }

      // Get current character position on the screen (column), calculates tab widths
      function col(position: vscode.Position) {
        const line = activeTextEditor!.document.lineAt(position.line)

        let column = 0
        for (let i = 0; i < position.character; i++) {
          column = line.text[i] === '\t'
            ? Math.ceil((column + 1) / tabSize) * tabSize // Round up to the next tab stop
            : column + 1
        }

        return column + 1
      }

      if (isEmpty) {
        currentSelectionStatusBarItem.text = `${line(start)}:${col(start)}`
      } else {
        const stats = isSingleLine
          ? `${end.character - start.character}C`
          : `${end.line - start.line + 1}L ${activeTextEditor.document.getText(activeTextEditor.selection).length}C`

        currentSelectionStatusBarItem.text = isSingleLine
          ? `${line(start)}:${col(start)}-${col(end)} (${stats})`
          : `${line(start)}:${col(start)}-${line(end)}:${col(end)} (${stats})`
      }

      currentSelectionStatusBarItem.show()
    } else {
      currentSelectionStatusBarItem.hide()
    }
  }

  // Copy currently opened file's absolute path
  registerCommand('streamline.currentPath.copy', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    // Save relative path when possible (but without workspace folder)
    const path = vscode.workspace.asRelativePath(activeTextEditor.document.uri.path, false)
    await vscode.env.clipboard.writeText(path)

    const copiedMessage = '⸱⸱⸱ copied!'
    currentPathStatusBarItem.text = currentPathStatusBarItem.text.length > copiedMessage.length
      ? currentPathStatusBarItem.text.slice(0, -copiedMessage.length) + copiedMessage
      : copiedMessage

    setTimeout(() => updateCurrentPathStatusBarItem(), 1000)
  })

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateCurrentPathStatusBarItem()
      updateCurrentSelectionStatusBarItem()
    }),
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
