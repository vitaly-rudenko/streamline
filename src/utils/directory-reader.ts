export type DirectoryReader = {
  read(path: string): Promise<string[]>
  exists(path: string): Promise<boolean>
}