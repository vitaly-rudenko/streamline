import * as vscode from 'vscode'

export function createHighlightedPathsFeature(input: {
  context: vscode.ExtensionContext
  onHighlightChanged: (payload: vscode.Uri | vscode.Uri[] | undefined) => unknown
}) {
  const { context, onHighlightChanged } = input

  let cachedHighlightedPathsRegExps: RegExp[] = []

  function isHighlighted(uncertainPath: string): boolean {
    return cachedHighlightedPathsRegExps.some(regExp => regExp.test(uncertainPath))
  }

  function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')
    const highlightedPaths = config.get<string[]>('highlightedPaths', [])

    cachedHighlightedPathsRegExps = highlightedPaths.map(highlightedPath => new RegExp(highlightedPath))

    onHighlightChanged(undefined)
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.highlightedPaths')) {
        refresh()
      }
    })
  )

  refresh()

  return { isHighlighted }
}
