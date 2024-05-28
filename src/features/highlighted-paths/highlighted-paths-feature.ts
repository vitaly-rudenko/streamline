import * as vscode from 'vscode'
import { config } from '../../config'

export async function createHighlightedPathsFeature(input: {
  context: vscode.ExtensionContext
  onHighlightChanged: (payload: vscode.Uri | vscode.Uri[] | undefined) => unknown
}) {
  const { context, onHighlightChanged } = input

  const patterns = config.get<string[]>('highlightedPaths.patterns', [])
  const cachedPatternRegExps = patterns.map(pattern => new RegExp(pattern))

  function isHighlighted(path: string): boolean {
    return cachedPatternRegExps.some(regExp => regExp.test(path))
  }

  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles((event) => onHighlightChanged(event.files.map(uri => uri))),
    vscode.workspace.onDidRenameFiles((event) => onHighlightChanged(event.files.map(file => file.newUri))),
  )

  return { isHighlighted }
}
