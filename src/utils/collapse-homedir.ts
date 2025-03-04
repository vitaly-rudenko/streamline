export function collapseHomedir(path: string, homedir: string) {
  return path.startsWith(homedir + '/') ? ('~' + path.slice(homedir.length)) : path
}
