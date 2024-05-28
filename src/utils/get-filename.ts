export function getFilename(path: string): string {
  return path.split('/').at(-1)!
}