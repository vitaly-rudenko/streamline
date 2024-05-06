export function serializeExcludes(input: { includedPaths: string[], excludedPaths: string[] }): Record<string, boolean> {
  const excludes: Record<string, boolean> = {};

  for (const excludedPath of input.excludedPaths) {
    excludes[serializePathExclude(excludedPath)] = true;
  }

  return excludes;
}

function serializePathExclude(path: string) {
  return path.endsWith('/') ? `${path}**` : path;
}
