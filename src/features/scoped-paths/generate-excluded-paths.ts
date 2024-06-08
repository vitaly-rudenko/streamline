import { getParents } from '../../utils/get-parents'

export async function generateExcludedPaths(includedPaths: string[], directoryReader: { read: (path: string) => Promise<string[]> }): Promise<string[]> {
  const includedPathsWithParents = new Set(
    includedPaths.flatMap((includedPath) => [includedPath, ...getParents(includedPath)])
  )

  const excludedPaths = new Set<string>()

  for (const includedPath of includedPaths) {
    const parents = getParents(includedPath)

    const children = (await Promise.all(parents.map(parent => directoryReader.read(parent))))
      .flat()
      .filter((child) =>
        !includedPathsWithParents.has(child) &&
        includedPaths.every((includedPath) => !child.startsWith(`${includedPath}/`) && child !== includedPath),
      )

    for (const child of children) {
      excludedPaths.add(child)
    }
  }

  return [...excludedPaths]
}

