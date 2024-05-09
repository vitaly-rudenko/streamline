import * as vscode from 'vscode'

export async function createHighlightedPathsFeature(input: {
  context: vscode.ExtensionContext
  onHighlightChanged: (payload: vscode.Uri | vscode.Uri[] | undefined) => unknown
}) {
  const { context, onHighlightChanged } = input

  let cachedHighlightedPathsRegExps: RegExp[] = []

  function isHighlighted(path: string): boolean {
    return cachedHighlightedPathsRegExps.some(regExp => regExp.test(path))
  }

  async function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')
    const highlightedPaths = config.get<string[]>('highlightedPaths', [])

    cachedHighlightedPathsRegExps = highlightedPaths.map(highlightedPath => new RegExp(highlightedPath))

    onHighlightChanged(undefined)
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('streamline.highlightedPaths')) {
        await refresh()
      }
    }),
    vscode.workspace.onDidCreateFiles((event) => onHighlightChanged(event.files.map(uri => uri))),
    vscode.workspace.onDidRenameFiles((event) => onHighlightChanged(event.files.map(file => file.newUri))),
  )

  await refresh()

  return { isHighlighted }
}
