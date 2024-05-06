export function serializeExcludes(includedPaths: string[], excludedPaths: string[]): Record<string, boolean> {
  const excludes: Record<string, boolean> = {};

  for (const includedPath of includedPaths) {
    excludes[serializePathExclude(includedPath)] = false;
  }

  for (const excludedPath of excludedPaths) {
    excludes[serializePathExclude(excludedPath)] = true;
  }

  return excludes;
}

export function deserializeExcludes(excludes: Record<any, boolean>): { includedPaths: string[]; excludedPaths: string[] } {
  const includedPaths = [];
  const excludedPaths = [];

  for (const [path, isExcluded] of Object.entries(excludes)) {
    if (isExcluded === true) {
      excludedPaths.push(deserializePathExclude(path));
    } else if (isExcluded === false) {
      includedPaths.push(deserializePathExclude(path));
    }
  }

  return { includedPaths, excludedPaths };
}

function serializePathExclude(path: string) {
  return path.endsWith('/') ? `${path}**` : path;
}

function deserializePathExclude(path: string) {
  return path.endsWith('/**') ? path.slice(0, -2) : path;
}
