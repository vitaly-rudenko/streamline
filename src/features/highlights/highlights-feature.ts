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
        .map(highlight => highlight.range)
    )

    activeTextEditor.setDecorations(
      selectionDecoration,
      highlights
        .filter(highlight => highlight.type === 'selection')
        .filter(highlight => highlight.uri.path === activeTextEditor.document.uri.path)
        .map(highlight => highlight.range)
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
    } catch (error) {
      console.warn('[Highlights] Could not update context', error)
    }
  }

  /** Recursively merge intersecting highlights */
  function mergeHighlights() {
    for (const [i, highlight1] of highlights.entries()) {
      for (const [j, highlight2] of highlights.entries()) {
        if (i === j) continue
        if (highlight1.type !== highlight2.type) continue

        if (
          highlight1.range.contains(highlight2.range) ||
          highlight2.range.contains(highlight1.range) ||
          highlight1.range.intersection(highlight2.range) !== undefined
        ) {
          const start = highlight1.range.start.isBefore(highlight2.range.start)
            ? highlight1.range.start
            : highlight2.range.start
          const end = highlight1.range.end.isAfter(highlight2.range.end)
            ? highlight1.range.end
            : highlight2.range.end

          highlights[i].range = new vscode.Range(start, end)
          highlights.splice(j, 1)
          return mergeHighlights()
        }
      }
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

    mergeHighlights()

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

    mergeHighlights()

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
