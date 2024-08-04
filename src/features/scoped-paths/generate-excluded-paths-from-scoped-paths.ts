import { getParents } from '../../utils/get-parents'
import type { DirectoryReader } from '../../utils/types'
import { unique } from '../../utils/unique'

export async function generateExcludedPathsFromScopedPaths(scopedPaths: string[], directoryReader: DirectoryReader, workspaceFolders: string[]): Promise<string[]> {
  if (scopedPaths.length === 0) return []

  const recursiveScopedOrphanPaths = new Set(
    removeWorkspaceFolders([
      ...scopedPaths,
      ...scopedPaths.flatMap(scopedPath => getParents(scopedPath))
    ])
  )

  let affectedPaths: string[] = (await Promise.all(
    workspaceFolders.map(workspaceFolder => directoryReader.read(workspaceFolder))
  )).flat()

  recursiveScopedOrphanPaths.delete('')
  for (const scopedOrphanPath of recursiveScopedOrphanPaths) {
    const children = (await Promise.all(
      workspaceFolders.map(workspaceFolder => directoryReader.read(`${workspaceFolder}/${scopedOrphanPath}`))
    )).flat()

    affectedPaths.push(...children)
  }

  const scopedPathsSet = new Set(scopedPaths)
  const scopedPathsAsFolders = scopedPaths.map(scopedPath => `${scopedPath}/`)
  const scopedAffectedOrphanPaths = new Set(
    removeWorkspaceFolders(
      affectedPaths.filter(affectedPath => (
        scopedPathsSet.has(affectedPath) ||
        scopedPathsAsFolders.some(scopedPathAsFolder => affectedPath.startsWith(scopedPathAsFolder))
      ))
    )
  )

  const excludedAffectedPaths = unique(removeWorkspaceFolders(affectedPaths))
    .filter(affectedOrphanPath => (
      !scopedAffectedOrphanPaths.has(affectedOrphanPath) &&
      !recursiveScopedOrphanPaths.has(affectedOrphanPath)
    ))

  return excludedAffectedPaths
}

function removeWorkspaceFolders(pathOrPaths: string[]): string[] {
  return pathOrPaths.map((path) => {
    const index = path.indexOf('/')
    if (index === -1) return path
    return path.slice(index + 1)
  })
}
