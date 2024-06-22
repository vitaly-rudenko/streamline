import { getParents } from '../../utils/get-parents'
import type { DirectoryReader } from '../../utils/types'
import { unique } from '../../utils/unique'

export async function generateScopeExcludes(scopedPaths: string[], directoryReader: DirectoryReader): Promise<string[]> {
  console.log('-----')

  const workspaceFolders = await directoryReader.read('')
  const recursiveScopedPaths = unique([
    ...scopedPaths,
    ...scopedPaths.flatMap(scopedPath => getParents(scopedPath))
  ])

  console.log('scopedPaths', scopedPaths, '=> scopedPathsWithParents', [...recursiveScopedPaths])

  let affectedPaths = []

  for (const scopedPath of recursiveScopedPaths) {
    // const children = await readDirectory(scopedPath)
    // affectedPaths.push(scopedPath, ...children)

    const children = (await Promise.all(
      workspaceFolders.map(
        workspaceFolder => directoryReader.read([workspaceFolder, removeWorkspaceFolder(scopedPath)].filter(Boolean).join('/'))
      )
    )).flat()

    // console.log('children of', scopedPath, 'in all workspace folders are', children)

    affectedPaths.push(scopedPath, ...getParents(scopedPath), ...children)
  }

  for (const affectedPath of affectedPaths) {
    // if workspace folder
    if (!affectedPath.includes('/')) {
      affectedPaths.push(...await directoryReader.read(affectedPath))
    }
  }

  affectedPaths = unique(affectedPaths.filter(
    affectedPath => affectedPath.includes('/')
  ))

  const scopedAffectedPaths = unique(
    removeWorkspaceFolder(
      affectedPaths.filter(
        affectedPath => scopedPaths.some(
          scopedPath => (
            getParents(scopedPath).includes(scopedPath) ||
            affectedPath === scopedPath ||
            affectedPath.startsWith(`${scopedPath}/`)
          )
        )
      )
    )
  )

  let excludedAffectedPaths = affectedPaths.filter(
    affectedPath => (
      !scopedAffectedPaths.includes(removeWorkspaceFolder(affectedPath))
    )
  )

  excludedAffectedPaths = excludedAffectedPaths.filter(
    excludedAffectedPath => (
      excludedAffectedPaths.every(anotherExcludedAffectedPath => (
        !removeWorkspaceFolder(anotherExcludedAffectedPath).startsWith(removeWorkspaceFolder(excludedAffectedPath) + '/')
      ))
    )
  )

  console.log('affectedPaths', affectedPaths)
  console.log('scopedAffectedPaths', scopedAffectedPaths)
  console.log('excludedAffectedPaths', excludedAffectedPaths)

  return unique(removeWorkspaceFolder(excludedAffectedPaths))
}

function removeWorkspaceFolder<T extends string | string[]>(pathOrPaths: T): T {
  return (Array.isArray(pathOrPaths)
    ? pathOrPaths.map(path => removeWorkspaceFolder(path))
    : pathOrPaths.split('/').slice(1).join('/')) as T
}
