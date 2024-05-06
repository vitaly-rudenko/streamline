export async function generateExcludedPaths(includedPaths: string[], readDirectory: (path: string) => Promise<string[]>) {
  const includedPathsWithParents = new Set(includedPaths.flatMap((includedPath) => [
    includedPath,
    ...getParents(includedPath),
  ]));
  const excludes = new Set();

  for (const includedPath of includedPaths) {
    const parents = getParents(includedPath);

    for (const parent of parents) {
      const children = await readDirectory(parent);
      const filteredChildren = children.filter((child) =>
        !includedPathsWithParents.has(child) &&
        includedPaths.every((ip) => !child.startsWith(ip)),
      );

      for (const filteredChild of filteredChildren) {
        excludes.add(filteredChild);
      }
    }
  }

  return [...excludes];
}

function getParents(path: string) {
  const parts = path.split("/");
  const parents = [];

  if (path.endsWith("/")) {
    parts.pop();
  }

  for (let i = 1; i < parts.length; i++) {
    parents.push(parts.slice(0, parts.length - i).join("/") + "/");
  }

  parents.push("");

  return parents;
}
