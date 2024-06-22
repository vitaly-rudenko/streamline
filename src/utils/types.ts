export type DirectoryReader = {
  read(path: string): Promise<string[]>
}