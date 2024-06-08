export function getSharedPath(paths: string[]): string {
  let sharedPath = paths[0]

  do {
    sharedPath = sharedPath.split('/').slice(0, -1).join('/')
  } while (sharedPath.length > 0 && paths.some(path => !path.startsWith(sharedPath)))

  return sharedPath
}
