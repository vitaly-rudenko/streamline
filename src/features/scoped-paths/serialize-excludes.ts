export function serializeExcludes(input: { includedPaths: string[]; excludedPaths: string[] }): Record<string, unknown> {
  const excludes: Record<string, unknown> = {
    '**/.git': true,
    '**/.svn': true,
    '**/.hg': true,
    '**/CVS': true,
    '**/.DS_Store': true,
    '**/Thumbs.db': true,
  }

  // TODO: VS Code doesn't support excluding files in a specific workspace folder using workspace configuration
  //       See https://github.com/microsoft/vscode/issues/82145

  const includedPaths = new Set(
    input.includedPaths
      .filter(path => path.includes('/'))
      .map(includedPath => includedPath.replace(/^.+?\//, ''))
  )

  const excludedPaths = new Set(
    input.excludedPaths
      .filter(path => path.includes('/'))
      .map(excludedPath => excludedPath.replace(/^.+?\//, ''))
      .filter(path => !includedPaths.has(path))
  )

  for (const excludedPath of excludedPaths) {
    excludes[serializePathExclude(excludedPath)] = true
  }

  return excludes
}

function serializePathExclude(path: string) {
  return `${path}/**`
}
