import { unique } from '../../utils/unique'

export function serializeExcludes(input: { excludedPaths: string[] }): Record<string, boolean> {
  const excludes: Record<string, boolean> = {
    '**/.git': true,
    '**/.svn': true,
    '**/.hg': true,
    '**/CVS': true,
    '**/.DS_Store': true,
    '**/Thumbs.db': true,
  }

  // TODO: VS Code doesn't support excluding files in a specific workspace folder using workspace configuration
  //       See https://github.com/microsoft/vscode/issues/82145
  const excludedPaths = unique(
    input.excludedPaths
      .filter(path => path.includes('/'))
      .map(excludedPath => excludedPath.replace(/^.+?\//, ''))
  )

  for (const excludedPath of excludedPaths) {
    excludes[serializePathExclude(excludedPath)] = true
  }

  return excludes
}

function serializePathExclude(path: string) {
  return `${path}/**`
}
