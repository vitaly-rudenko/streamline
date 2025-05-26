import * as vscode from 'vscode'
import { RegisterCommand } from '../../register-command'
import { Highlight } from './common'
import { DynamicHighlightsProvider } from './dynamic-highlights-provider'
import { formatPaths } from '../../utils/format-paths'
import { formatSelectionValue } from '../bookmarks/bookmarks-tree-data-provider'

// TODO: More permanent storage (workspaceState)
// TODO: Debouncing & performance improvements
// TODO: Color customization

export function createHighlightsFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
  dynamicHighlightsProviders: DynamicHighlightsProvider[]
}) {
  const { context, registerCommand, dynamicHighlightsProviders } = input

  let highlights: Highlight[] = []

  const lineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(67, 222, 239, 0.1)',
    overviewRulerColor: 'rgba(67, 222, 239, 0.1)',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    isWholeLine: true,
  })

  const selectionDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(67, 222, 239, 0.1)',
    overviewRulerColor: 'rgba(67, 222, 239, 0.1)',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  })

  const dynamicLineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(239, 133, 67, 0.1)',
    overviewRulerColor: 'rgba(239, 133, 67, 0.1)',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    isWholeLine: true,
  })

  const dynamicSelectionDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(239, 133, 67, 0.1)',
    overviewRulerColor: 'rgba(239, 133, 67, 0.1)',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
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
      dynamicSelectionDecoration,
      mergeHighlights(dynamicHighlights.filter(highlight => highlight.type === 'selection')).map(highlight => highlight.range)
    )

    activeTextEditor.setDecorations(
      dynamicLineDecoration,
      mergeHighlights(dynamicHighlights.filter(highlight => highlight.type === 'line')).map(highlight => highlight.range)
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
      value: activeTextEditor.document.getText(activeTextEditor.selection),
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
    const range = new vscode.Range(startLine.range.start, endLine.range.end)

    highlights.push({
      type: 'line',
      uri: activeTextEditor.document.uri,
      range,
      value: activeTextEditor.document.getText(range),
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
    highlights = []

    updateDecorations()
    await updateContext()
  })

  registerCommand('streamline.highlights.quickOpen', async () => {
    const highlightsToSelectFrom = highlights
      // Sort by line number
      .sort((a, b) => a.range.start.line - b.range.start.line)
      // Sort by path
      .sort((a, b) => a.uri.path.localeCompare(b.uri.path))

    if (highlightsToSelectFrom.length === 0) {
      vscode.window.showInformationMessage('You don\'t have any Highlights yet')
      return
    }

    const uris = highlightsToSelectFrom.map(highlight => highlight.uri)
    const formattedPaths = formatPaths(uris.map(uri => uri.path))

    type QuickPickItem = vscode.QuickPickItem & ({ highlight?: Highlight; uri: vscode.Uri })

    const quickPick = vscode.window.createQuickPick<QuickPickItem>()
    quickPick.items = highlightsToSelectFrom.flatMap((highlight, i) => {
      const label = formattedPaths.get(highlight.uri.path)!
      const results: QuickPickItem[] = []

      if (i === 0 || highlights[i - 1].uri.path !== highlight.uri.path) {
        results.push({
          label,
          description: vscode.workspace.asRelativePath(highlight.uri.path),
          iconPath: new vscode.ThemeIcon('file'),
          uri: highlight.uri,
          buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
        })
      }

      const preview = formatSelectionValue(highlight.range, highlight.value)
      results.push({
        label: `${highlight.note ? highlight.note : preview}`,
        description: highlight.note ? preview : undefined,
        uri: highlight.uri,
        highlight,
        iconPath: new vscode.ThemeIcon('indent'),
        buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
      })

      return results
    })

    quickPick.onDidAccept(async () => {
      const [selected] = quickPick.selectedItems
      if (!selected) return quickPick.dispose()

      await vscode.window.showTextDocument(
        selected.uri,
        {
          preview: false,
          ...selected.highlight && {
            selection: selected.highlight.range,
          }
        }
      )

      quickPick.dispose()
    })

    quickPick.onDidTriggerItemButton(async ({ item }) => {
      if (!item) return quickPick.dispose()

      await vscode.window.showTextDocument(
        item.uri,
        {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
          ...item.highlight && {
            selection: item.highlight.range,
          }
        }
      )

      quickPick.dispose()
    })

    quickPick.onDidHide(() => quickPick.dispose())
    quickPick.show()
  })

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async () => {
      updateDecorations()
      await updateContext()
    }),
    // Sometimes Highlights get unintentionally modified due to changing code inside of them (automatically by VS Code),
    // so we need to refresh decorations to ensure that they match reality
    vscode.window.onDidChangeTextEditorSelection(() => updateDecorations()),
    // When Untitled file is closed, we need to remove its Highlights to prevent them from unintentionally transferring
    // to a new Untitled file with the same name (path)
    vscode.workspace.onDidCloseTextDocument((textDocument) => {
      if (textDocument.uri.scheme === 'untitled') {
        highlights = highlights.filter(highlight => highlight.uri.path !== textDocument.uri.path)
      }
    })
  )

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
