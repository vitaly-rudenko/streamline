import { getConfig, initialConfig } from '../../config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'
import { FeatureConfig } from '../feature-config'

const defaultBackupEnabled = false
const defaultBackupSize = 100
const defaultBackupRecords = {}

export class TabHistoryConfig extends FeatureConfig {
  private _backupEnabled: boolean = defaultBackupEnabled
  private _backupSize: number = defaultBackupSize
  private _backupRecords: Record<string, number> = defaultBackupRecords
  private _pinnedPaths: string[] = []
  private _cachedPinnedPathsSet: Set<string> = new Set()

  constructor() {
    super('TabHistory')
    this._updatePinnedPathsCache()
  }

  load(config = initialConfig) {
    const backupEnabled = config.get<boolean>('tabHistory.backup.enabled', defaultBackupEnabled)
    const backupSize = config.get<number>('tabHistory.backup.size', defaultBackupSize)
    const backupRecords = config.get<Record<string, number>>('tabHistory.backup.records', defaultBackupRecords)
    const pinnedPaths = config.get<string[]>('tabHistory.pinnedPaths', [])

    let hasChanged = false

    if (
      this._backupEnabled !== backupEnabled
      || this._backupSize !== backupSize
      || !areObjectsShallowEqual(this._backupRecords, backupRecords)
      || !areArraysShallowEqual(this._pinnedPaths, pinnedPaths)
    ) {
      this._backupEnabled = backupEnabled
      this._backupSize = backupSize
      this._backupRecords = backupRecords
      this._pinnedPaths = pinnedPaths

      hasChanged = true
    }

    if (hasChanged) {
      this._updatePinnedPathsCache()
    }

    console.debug('[TabHistory] Config has been loaded', { hasChanged, backupEnabled, backupSize, backupRecords, pinnedPaths })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await config.update(
      'tabHistory.backup.enabled',
      this._backupEnabled !== defaultBackupEnabled ? this._backupEnabled : undefined
    )

    await config.update(
      'tabHistory.backup.size',
      this._backupSize !== defaultBackupSize ? this._backupSize : undefined
    )

    await config.update(
      'tabHistory.backup.records',
      Object.keys(this._backupRecords).length > 0 ? this._backupRecords : undefined
    )

    await config.update(
      'tabHistory.pinnedPaths',
      this._pinnedPaths.length > 0 ? this._pinnedPaths : undefined
    )

    console.debug('[TabHistory] Config has been saved')
  }

  private _updatePinnedPathsCache() {
    this._cachedPinnedPathsSet = new Set(this._pinnedPaths)
  }

  getCachedPinnedPathsSet() {
    return this._cachedPinnedPathsSet
  }

  getBackupSize() {
    return this._backupSize
  }

  setBackupEnabled(value: boolean) {
    this._backupEnabled = value
  }

  getBackupEnabled() {
    return this._backupEnabled
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
