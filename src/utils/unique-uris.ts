import { Uri } from 'vscode';

export function uniqueUris(uris: Uri[]): Uri[] {
  const paths = new Set<string>()
  return uris.filter(uri => {
    if (paths.has(uri.path)) return false
    paths.add(uri.path)
    return true
  })
}
