import { Uri, window } from 'vscode'
import { uriToPath } from '../../../utils/uri-to-path'

/** Returns a list of the targeted paths for a VS Code command context */
export function getTargetPathsForCommand(uri: Uri | undefined, selectedUris: Uri[] | undefined): string[] {
  let uris: Uri[] = []
  if (selectedUris && selectedUris.length > 0) {
    uris = selectedUris
  } else if (uri) {
    uris = [uri]
  } else if (window.activeTextEditor?.document.uri) {
    uris = [window.activeTextEditor.document.uri]
  }

  return uris.map(uri => uriToPath(uri)).filter((path): path is string => path !== undefined)
}