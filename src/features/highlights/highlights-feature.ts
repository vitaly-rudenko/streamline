import * as vscode from 'vscode'
import { RegisterCommand } from '../../register-command'

type Highlight = {
  uri: vscode.Uri
  range: vscode.Range
  type: 'selection' | 'line'
}

export function createHighlightsFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
}) {
  const { context, registerCommand } = input

  let highlights: Highlight[] = []

  const lineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(67, 222, 239, 0.15)',
    overviewRulerColor: 'rgba(67, 222, 239, 0.15)',
    isWholeLine: true,
  })

  const selectionDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(67, 222, 239, 0.15)',
    overviewRulerColor: 'rgba(67, 222, 239, 0.15)',
  })

  function updateDecorations() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    activeTextEditor.setDecorations(
      lineDecoration,
      highlights
        .filter(highlight => highlight.type === 'line')
        .filter(highlight => highlight.uri.path === activeTextEditor.document.uri.path)
        .map(highlight => ({ range: highlight.range }))
    )

    activeTextEditor.setDecorations(
      selectionDecoration,
      highlights
        .filter(highlight => highlight.type === 'selection')
        .filter(highlight => highlight.uri.path === activeTextEditor.document.uri.path)
        .map(highlight => ({ range: highlight.range }))
    )
  }

  async function updateContext() {
    try {
      const activeTextEditor = vscode.window.activeTextEditor

      await Promise.all([
        vscode.commands.executeCommand('setContext', 'streamline.highlights.hasHighlight', highlights.length > 0),
        vscode.commands.executeCommand(
          'setContext',
          'streamline.highlights.hasHighlightInFile',
          activeTextEditor
            ? highlights.some(highlight => highlight.uri.path === activeTextEditor.document.uri.path)
            : false
        ),
      ])
    } catch (err) {
      // TODO: err
    }
  }

  registerCommand('streamline.highlights.addSelection', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    highlights.push({
      type: 'selection',
      uri: activeTextEditor.document.uri,
      range: activeTextEditor.selection,
    })

    updateDecorations()
    await updateContext()
  })

    registerCommand('streamline.highlights.addLines', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    // Expand selection to contain all characters in the lines
    // Does not impact rendering, but can impact context menu commands
    const startLine = activeTextEditor.document.lineAt(activeTextEditor.selection.start.line)
    const endLine = activeTextEditor.document.lineAt(activeTextEditor.selection.end.line)

    highlights.push({
      type: 'line',
      uri: activeTextEditor.document.uri,
      range: new vscode.Range(startLine.range.start, endLine.range.end),
    })

    updateDecorations()
    await updateContext()
  })

  registerCommand('streamline.highlights.removeInSelection', async () => {
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

  registerCommand('streamline.highlights.removeInFile', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    highlights = highlights.filter(highlight => highlight.uri.path !== activeTextEditor.document.uri.path)

    updateDecorations()
    await updateContext()
  })

  registerCommand('streamline.highlights.removeAll', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    highlights = []

    updateDecorations()
    await updateContext()
  })

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async () => {
      updateDecorations()
      await updateContext()
    }),
  )

  updateContext()
  updateDecorations()
}
