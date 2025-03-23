export function expandHomedir(path: string, homedir: string) {
  return path.startsWith('~/') ? (homedir + path.slice(1)) : path
}