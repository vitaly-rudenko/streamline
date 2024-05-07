import { getParents } from '../../utils/get-parents'

export async function generateExcludedPaths(includedPaths: string[], readDirectory: (path: string) => Promise<string[]>): Promise<string[]> {
  const includedPathsWithParents = new Set(
    includedPaths.flatMap((includedPath) => [includedPath, ...getParents(includedPath)])
  )

  const excludedPaths = new Set<string>()

  for (const includedPath of includedPaths) {
    const parents = getParents(includedPath)

    const children = (await Promise.all(parents.map(parent => readDirectory(parent))))
      .flat()
      .filter((child) =>
        !includedPathsWithParents.has(child) &&
        includedPaths.every((includedPath) => !child.startsWith(includedPath)),
      )

    for (const child of children) {
      excludedPaths.add(child)
    }
  }

  return [...excludedPaths]
}

