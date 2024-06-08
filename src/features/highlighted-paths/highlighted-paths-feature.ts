import * as vscode from 'vscode'
import { HighlightedPathsConfig } from './highlighted-paths-config'

export function createHighlightedPathsFeature(input: { context: vscode.ExtensionContext, onChange: () => unknown }) {
  const { context, onChange } = input

  const config = new HighlightedPathsConfig()

  function isPathHighlighted(path: string): boolean {
    return config.getCachedCombinedPatternRegExp()?.test(path) === true
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.highlightedPaths')) {
        if (config.load()) {
          onChange()
        }
      }
    }),
  )

  config.load()

  return { isPathHighlighted }
}
