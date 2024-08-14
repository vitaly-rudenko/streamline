import { getParents } from '../../utils/get-parents'
import type { DirectoryReader } from '../../utils/types'
import { unique } from '../../utils/unique'

export async function generateExcludedPathsFromScopedAndExcludedPaths(scopedAndExcludedPaths: string[], directoryReader: DirectoryReader): Promise<string[]> {
  const scopedPaths = scopedAndExcludedPaths.filter(path => !path.startsWith('!'))
  const excludedPaths = scopedAndExcludedPaths.filter(path => path.startsWith('!')).map(path => path.slice(1))

  const [excludedPathsFromScopedPath, excludedPathsForExcludedPaths] = await Promise.all([
    generateExcludedPathsFromScopedPaths(scopedPaths, directoryReader),
    generateExcludedPathsFromExcludedPaths(excludedPaths, directoryReader),
  ])

  return unique([...excludedPathsFromScopedPath, ...excludedPathsForExcludedPaths])
}

async function generateExcludedPathsFromScopedPaths(scopedPaths: string[], directoryReader: DirectoryReader) {
  if (scopedPaths.length === 0) return []

  const workspaceFolders = await directoryReader.read('')
  const recursiveScopedOrphanPaths = new Set(
    removeWorkspaceFolders([
      ...scopedPaths,
      ...scopedPaths.flatMap(scopedPath => getParents(scopedPath))
    ])
  )

  const affectedPaths: string[] = await readInAllWorkspaceFolders(workspaceFolders, '', directoryReader)

  recursiveScopedOrphanPaths.delete('')
  for (const scopedOrphanPath of recursiveScopedOrphanPaths) {
    const children = await readInAllWorkspaceFolders(workspaceFolders, scopedOrphanPath, directoryReader)
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

  const results = removeWorkspaceFolders(affectedPaths)
    .filter(affectedOrphanPath => (
      !scopedAffectedOrphanPaths.has(affectedOrphanPath) &&
      !recursiveScopedOrphanPaths.has(affectedOrphanPath)
    ))

  return results
}

async function generateExcludedPathsFromExcludedPaths(excludedPaths: string[], directoryReader: DirectoryReader) {
  if (excludedPaths.length === 0) return []

  const allWorkspaceFolders = await directoryReader.read('')
  const excludedWorkspaceFolders = excludedPaths.filter(path => !path.includes('/'))
  const nonExcludedWorkspaceFolders = allWorkspaceFolders.filter(workspaceFolder => !excludedWorkspaceFolders.includes(workspaceFolder))

  const pathsToExclude = excludedPaths.filter(path => path.includes('/'))
  const pathsToExcludeWithoutWorkspaceFolders = removeWorkspaceFolders(pathsToExclude)

  const results = []
  for (const excludedPathWithoutWorkspaceFolder of pathsToExcludeWithoutWorkspaceFolders) {
    const excludedOrNotExistsPerWorkspaceFolder = await Promise.all(
      allWorkspaceFolders.map(async (workspaceFolder) => {
        const pathToCheck = `${workspaceFolder}/${excludedPathWithoutWorkspaceFolder}`
        if (excludedPaths.includes(pathToCheck)) return true

        const exists = await directoryReader.exists(`${workspaceFolder}/${excludedPathWithoutWorkspaceFolder}`)
        return !exists
      })
    )

    if (excludedOrNotExistsPerWorkspaceFolder.every(Boolean)) {
      results.push(excludedPathWithoutWorkspaceFolder)
    }
  }

  if (excludedWorkspaceFolders.length > 0) {
    const pathsFromExcludedWorkspaceFolders = await readInAllWorkspaceFolders(excludedWorkspaceFolders, '', directoryReader)
    const pathsFromNonExcludedWorkspaceFolders = new Set(removeWorkspaceFolders(await readInAllWorkspaceFolders(nonExcludedWorkspaceFolders, '', directoryReader)))

    const workspacePathsToExclude = removeWorkspaceFolders(pathsFromExcludedWorkspaceFolders).filter(path => !pathsFromNonExcludedWorkspaceFolders.has(path))
    results.push(...workspacePathsToExclude)
  }

  return results
}

async function readInAllWorkspaceFolders(workspaceFolders: string[], path: string, directoryReader: DirectoryReader): Promise<string[]> {
  return (await Promise.all(
    workspaceFolders.map(
      workspaceFolder => directoryReader.read([workspaceFolder, path].filter(Boolean).join('/'))
    )
  )).flat()
}

function removeWorkspaceFolders(pathOrPaths: string[], options?: { excludeWorkspaceFolders: boolean }): string[] {
  return pathOrPaths.map((path) => {
    const index = path.indexOf('/')
    if (index === -1) {
      return options?.excludeWorkspaceFolders ? undefined : path
    }

    return path.slice(index + 1)
  }).filter(path => path !== undefined)
}
