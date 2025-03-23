import * as vscode from 'vscode'
import { generateRelatedFilesGlobs } from './toolkit/generate-related-files-globs'
import { RelatedFilesConfig } from './related-files-config'

export class RelatedFilesFinder {
  constructor(private readonly config: RelatedFilesConfig) {}

  async *stream(currentUri: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder | undefined, limit: number): AsyncGenerator<vscode.Uri[]> {
    const relativePath = vscode.workspace.asRelativePath(currentUri, false)
    const relatedFilesQueries = generateRelatedFilesGlobs(relativePath)

    // Limit search to workspace folder when provided
    const includes = workspaceFolder
      ? relatedFilesQueries.map(query => new vscode.RelativePattern(workspaceFolder.uri, query))
      : [...relatedFilesQueries]

    const excludePattern = this.generateExcludePattern()

    const handledPaths = new Set([currentUri.path])

    for (const include of includes) {
      // TODO: Use findFiles2() when API is stable
      //       See https://github.com/microsoft/vscode/pull/203844
      const matchedUris = await vscode.workspace.findFiles(include, excludePattern, limit + handledPaths.size) // +handledPaths.size to avoid already handled files

      const batch: vscode.Uri[] = []
      for (const uri of matchedUris) {
        if (handledPaths.has(uri.path)) continue
        handledPaths.add(uri.path)
        batch.push(uri)
      }

      if (batch.length > 0) yield batch
      if (handledPaths.size >= limit + 1) break // +1 to ignore currentUri
    }
  }

  async find(currentUri: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder | undefined, limit: number): Promise<vscode.Uri[]> {
    const matches: vscode.Uri[] = []
    for await (const batch of this.stream(currentUri, workspaceFolder, limit)) {
      matches.push(...batch)
    }
    return matches
  }

  private generateExcludePattern() {
    const searchExcludes = vscode.workspace.getConfiguration('search').get<Record<string, unknown>>('exclude')
    const excludeEntries = Object.entries({
      ...searchExcludes,
      ...this.config.getCustomExcludes(),
    })

    return excludeEntries.length > 0
      ? `{${excludeEntries.filter(([_, value]) => value === true).map(([key]) => key).join(',')}}`
      : undefined
  }
}
