import { getParents } from '../../utils/get-parents'
import { unique } from '../../utils/unique'

export async function generateExcludedPaths(includedPaths: string[], readDirectory: (path: string) => Promise<string[]>): Promise<string[]> {
  const includedPathsWithParents = new Set(includedPaths.flatMap((includedPath) => [
    includedPath,
    ...getParents(includedPath),
  ]))

  const excludedPaths = new Set<string>()

  for (const includedPath of includedPaths) {
    const parents = getParents(includedPath)

    for (const parent of parents) {
      const children = await readDirectory(parent)
      const filteredChildren = children.filter((child) =>
        !includedPathsWithParents.has(child) &&
        includedPaths.every((includedPath) => !child.startsWith(includedPath)),
      )

      for (const filteredChild of filteredChildren) {
        excludedPaths.add(filteredChild)
      }
    }
  }

  return [...excludedPaths]
}

