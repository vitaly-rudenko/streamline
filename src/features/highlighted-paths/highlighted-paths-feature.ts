import * as vscode from 'vscode'
import { config } from '../../config'

export function createHighlightedPathsFeature(input: { context: vscode.ExtensionContext, onChange: () => unknown }) {
  const { context, onChange } = input

  let patterns: string[] = []
  let cachedPatternRegExps: RegExp[] = []

  function loadPatterns() {
    patterns = config.get<string[]>('highlightedPaths.patterns', [])
    cachedPatternRegExps = patterns.map(pattern => new RegExp(pattern))
  }

  function isHighlighted(path: string): boolean {
    return cachedPatternRegExps.some(regExp => regExp.test(path))
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('highlightedPaths.patterns')) {
        loadPatterns()
        onChange()
      }
    }),
  )

  loadPatterns()

  return { isHighlighted }
}
