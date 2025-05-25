import * as vscode from 'vscode'
import { RegisterCommand } from '../../register-command'

type Highlight = {
  uri: vscode.Uri
  range: vscode.Range
}

export function createHighlightsFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
}) {
  const { context, registerCommand } = input

  let highlights: Highlight[] = []

  const decoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(65, 135, 225, 0.1)',
  })

  function updateDecorations() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    activeTextEditor.setDecorations(
      decoration,
      highlights
        .filter(highlight => highlight.uri.path === activeTextEditor.document.uri.path)
        .map(highlight => ({ range: highlight.range }))
    )
  }

  async function updateContext() {
    try {
      const activeTextEditor = vscode.window.activeTextEditor
 
      await Promise.all([
        vscode.commands.executeCommand(
          'setContext',
          'streamline.highlights.highlightSelected',
          activeTextEditor
            ? highlights.some(
                highlight => 
                  highlight.uri.path === activeTextEditor.document.uri.path &&
                  (
                    highlight.range.contains(activeTextEditor.selection.active) ||
                    highlight.range.intersection(activeTextEditor.selection)
                  )
              )
            : false
        )
      ])
    } catch (err) {
      // TODO: err
    }
  }

  registerCommand('streamline.highlights.addSelection', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    if (activeTextEditor.selection.isEmpty) return

    highlights.push({
      uri: activeTextEditor.document.uri,
      range: activeTextEditor.selection,
    })

    updateDecorations()
    await updateContext()
  })

  registerCommand('streamline.highlights.removeSelection', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    highlights = highlights.filter(
      highlight => !(
        highlight.uri.path === activeTextEditor.document.uri.path &&
        (
          highlight.range.contains(activeTextEditor.selection.active) ||
          highlight.range.intersection(activeTextEditor.selection)
        )
      )
    )

    updateDecorations()
    await updateContext()
  })

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async () => {
      updateDecorations()
      await updateContext()
    }),
    vscode.window.onDidChangeTextEditorSelection(async () => {
      await updateContext()
    })
  )

  updateContext()
  updateDecorations()
}
