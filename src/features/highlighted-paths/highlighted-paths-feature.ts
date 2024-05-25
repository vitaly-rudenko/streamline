import * as vscode from 'vscode'

export async function createHighlightedPathsFeature(input: {
  context: vscode.ExtensionContext
  onHighlightChanged: (payload: vscode.Uri | vscode.Uri[] | undefined) => unknown
}) {
  const { context, onHighlightChanged } = input

  let cachedPatternRegExps: RegExp[] = []

  function isHighlighted(path: string): boolean {
    return cachedPatternRegExps.some(regExp => regExp.test(path))
  }

  async function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')
    const patterns = config.get<string[]>('highlightedPaths.patterns', [])

    cachedPatternRegExps = patterns.map(pattern => new RegExp(pattern))

    onHighlightChanged(undefined)
  }

  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles((event) => onHighlightChanged(event.files.map(uri => uri))),
    vscode.workspace.onDidRenameFiles((event) => onHighlightChanged(event.files.map(file => file.newUri))),
  )

  await refresh()

  return { isHighlighted }
}
