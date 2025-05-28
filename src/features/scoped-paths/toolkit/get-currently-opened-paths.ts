import * as vscode from 'vscode'
import { uriToPath } from '../../../utils/uri-to-path'

export function getCurrentlyOpenedPaths(): string[] {
  return vscode.window.tabGroups.all
    .flatMap(tabGroup => tabGroup.tabs)
    .map(tab => tab.input)
    .map(input => input && typeof input === 'object' && 'uri' in input ? input.uri as vscode.Uri : undefined)
    .filter(uri => uri !== undefined)
    .map(uri => uriToPath(uri))
    .filter(path => path !== undefined)
}
