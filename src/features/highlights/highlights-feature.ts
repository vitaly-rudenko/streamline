import * as vscode from 'vscode'
import { RegisterCommand } from '../../register-command'
import { Highlight } from './common'
import { DynamicHighlightsProvider } from './dynamic-highlights-provider'

export function createHighlightsFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
  dynamicHighlightsProviders: DynamicHighlightsProvider[]
}) {
  const { context, registerCommand, dynamicHighlightsProviders } = input

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

  const dynamicDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(239, 133, 67, 0.15)',
    overviewRulerColor: 'rgba(239, 133, 67, 0.15)',
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

    const dynamicHighlights = dynamicHighlightsProviders
      .flatMap(dynamicHighlightsProvider => dynamicHighlightsProvider.getHighlights(activeTextEditor.document.uri))

    activeTextEditor.setDecorations(
      dynamicDecoration,
      mergeHighlights(dynamicHighlights).map(highlight => highlight.range)
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

  // TODO: Make non-mutable
  /** Recursively merge intersecting highlights */
  function mergeHighlights(source = highlights) {
    for (const [i, highlight1] of source.entries()) {
      for (const [j, highlight2] of source.entries()) {
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

          source[i].range = new vscode.Range(start, end)
          source.splice(j, 1)
          return mergeHighlights(source)
        }
      }
    }

    return source
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

  console.log({ dynamicHighlightsProviders })
  for (const dynamicHighlightsProvider of dynamicHighlightsProviders) {
    if (dynamicHighlightsProvider.subscribe) {
      dynamicHighlightsProvider.subscribe(async () => {
        updateDecorations()
        await updateContext()
      })
    }
  }

  updateContext()
  updateDecorations()
}
