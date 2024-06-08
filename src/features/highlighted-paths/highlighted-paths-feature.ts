import * as vscode from 'vscode'

export function createHighlightedPathsFeature(input: { context: vscode.ExtensionContext, onChange: () => unknown }) {
  const { context, onChange } = input

  let pattern: RegExp

  function loadConfig() {
    const config = vscode.workspace.getConfiguration('streamline')
    const patterns = config.get<string[]>('highlightedPaths.patterns', [])

    pattern = new RegExp(patterns.join('|'))
  }

  function isPathHighlighted(path: string): boolean {
    return pattern.test(path)
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.highlightedPaths')) {
        loadConfig()
        onChange()
      }
    }),
  )

  loadConfig()

  return { isPathHighlighted }
}
