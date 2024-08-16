import { Memento } from 'vscode'

export class TabHistoryWorkspaceState {
  private _backupRecords: Record<string, number> = {}
  private _pinnedPaths: string[] = []
  private _cachedPinnedPathsSet: Set<string> = new Set()

  constructor(private readonly workspaceState: Memento) {
    this.load()
    this._updatePinnedPathsCache()
  }

  private load() {
    const backupRecords = this.workspaceState.get<Record<string, number>>('streamline.tabHistory.backup.records', {})
    const pinnedPaths = this.workspaceState.get<string[]>('streamline.tabHistory.pinnedPaths', [])

    this._backupRecords = backupRecords
    this._pinnedPaths = pinnedPaths
    this._updatePinnedPathsCache()

    console.debug('[TabHistory] WorkspaceState has been loaded', { backupRecords, pinnedPaths })
  }

  async save() {
    await this.workspaceState.update(
      'streamline.tabHistory.backup.records',
      Object.keys(this._backupRecords).length > 0 ? this._backupRecords : undefined
    )

    await this.workspaceState.update(
      'streamline.tabHistory.pinnedPaths',
      this._pinnedPaths.length > 0 ? this._pinnedPaths : undefined
    )

    console.debug('[TabHistory] WorkspaceState has been saved')
  }

  private _updatePinnedPathsCache() {
    this._cachedPinnedPathsSet = new Set(this._pinnedPaths)
  }

  getCachedPinnedPathsSet() {
    return this._cachedPinnedPathsSet
  }

  setBackupRecords(value: Record<string, number>) {
    this._backupRecords = value
  }

  getBackupRecords() {
    return this._backupRecords
  }

  setPinnedPaths(value: string[]) {
    this._pinnedPaths = value
    this._updatePinnedPathsCache()
  }

  getPinnedPaths() {
    return this._pinnedPaths
  }
}
