import * as vscode from 'vscode'
import * as os from 'os'
import { RegisterCommand } from '../../register-command'
import { collapseHomedir } from '../../utils/collapse-homedir'
import { collapsePath } from '../../utils/collapse-path'

const MAX_LABEL_LENGTH = 60

export function createCurrentPathFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
}) {
  const { context, registerCommand } = input

  const homedir = os.homedir()

  const currentPathStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999)
  currentPathStatusBarItem.name = 'Current Path: Relative Path'
  currentPathStatusBarItem.tooltip = 'Copy Relative Path'
  currentPathStatusBarItem.command = 'streamline.currentPath.copy'
  context.subscriptions.push(currentPathStatusBarItem)

  const currentSelectionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 999)
  currentSelectionStatusBarItem.name = 'Current Path: Current Selection'
  currentSelectionStatusBarItem.tooltip = new vscode.MarkdownString([
    '**Current Selection**',
    '- **S** - selections',
    '- **L** - lines in first selection',
    '- **C** - characters in first selection',
    '- **T** - total characters in all selections',
  ].join('  \n'))
  context.subscriptions.push(currentSelectionStatusBarItem)

  function updateCurrentPathStatusBarItem() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (activeTextEditor) {
      // Show relative path when possible
      const path = collapseHomedir(vscode.workspace.asRelativePath(activeTextEditor.document.uri.path), homedir)
      currentPathStatusBarItem.text = collapsePath(path, MAX_LABEL_LENGTH)
      currentPathStatusBarItem.show()
    } else {
      currentPathStatusBarItem.hide()
    }
  }

  function updateCurrentSelectionStatusBarItem() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (activeTextEditor) {
      const { start, end, isSingleLine } = activeTextEditor.selection

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

      if (activeTextEditor.selections.every(selection => selection.isEmpty)) {
        const multiSelectionStats = activeTextEditor.selections.length > 1 ? ` (${activeTextEditor.selections.length}S)` : ''

        currentSelectionStatusBarItem.text = `${line(start)}:${col(start)}${multiSelectionStats}`
      } else {
        const stats = isSingleLine
          ? `${end.character - start.character}C`
          : `${end.line - start.line + 1}L ${activeTextEditor.document.getText(activeTextEditor.selection).length}C`

        const multiSelectionStats = activeTextEditor.selections.length > 1 ? `${activeTextEditor.selections.length}S ` : ''
        const totalCharactersState = activeTextEditor.selections.length > 1
          ? ` ${activeTextEditor.selections.reduce((acc, curr) => acc + activeTextEditor.document.getText(curr).length, 0)}T`
          : ''

        currentSelectionStatusBarItem.text = isSingleLine
          ? `${line(start)}:${col(start)}-${col(end)} (${multiSelectionStats}${stats}${totalCharactersState})`
          : `${line(start)}:${col(start)}-${line(end)}:${col(end)} (${multiSelectionStats}${stats}${totalCharactersState})`
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

    const copiedMessage = ' $(check) copied!'
    const copiedMessageLength = copiedMessage.length - 6
    currentPathStatusBarItem.text = currentPathStatusBarItem.text.length > copiedMessageLength
      ? currentPathStatusBarItem.text.slice(0, -copiedMessageLength) + copiedMessage
      : copiedMessage

    setTimeout(() => updateCurrentPathStatusBarItem(), 1000)
  })

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateCurrentPathStatusBarItem()
      updateCurrentSelectionStatusBarItem()
    }),
    vscode.window.onDidChangeTextEditorSelection(() => updateCurrentSelectionStatusBarItem()),
  )

  updateCurrentPathStatusBarItem()
  updateCurrentSelectionStatusBarItem()
}
