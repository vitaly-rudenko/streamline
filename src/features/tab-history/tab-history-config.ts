import { getConfig } from '../../config'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'

const defaultBackupEnabled = false
const defaultBackupSize = 100
const defaultBackupRecords = {}

export class TabHistoryConfig {
  private _backupEnabled: boolean = defaultBackupEnabled
  private _backupSize: number = defaultBackupSize
  private _backupRecords: Record<string, number> = defaultBackupRecords

  load() {
    const config = getConfig()
    const backupEnabled = config.get<boolean>('tabHistory.backup.enabled', defaultBackupEnabled)
    const backupSize = config.get<number>('tabHistory.backup.size', defaultBackupSize)
    const backupRecords = config.get<Record<string, number>>('tabHistory.backup.records', defaultBackupRecords)

    let hasChanged = false

    if (
      this._backupEnabled !== backupEnabled ||
      this._backupSize !== backupSize
    ) {
      this._backupEnabled = backupEnabled
      this._backupSize = backupSize

      hasChanged = true
    }

    if (!areObjectsShallowEqual(this._backupRecords, backupRecords)) {
      this._backupRecords = backupRecords

      hasChanged = true
    }

    console.debug('[TabHistory] Config has been loaded', { hasChanged, enabled: backupEnabled, size: backupSize, records: backupRecords })

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
      Object.keys(this._backupRecords).length > 0
        ? this._backupRecords : undefined
    )

    console.debug('[TabHistory] Config has been saved')
  }

  get backupEnabled() {
    return this._backupEnabled
  }

  get backupSize() {
    return this._backupSize
  }

  set backupRecords(value: Record<string, number>) {
    this._backupRecords = value
  }

  get backupRecords() {
    return this._backupRecords
  }
}
