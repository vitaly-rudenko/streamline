import { getConfig } from '../../config'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'

export class TabHistoryConfig {
  private _enabled: boolean = false
  private _size: number = 100
  private _records: Record<string, number> = {}

  load() {
    const config = getConfig()
    const enabled = config.get<boolean>('tabHistory.enabled', true)
    const size = config.get<number>('tabHistory.size', 100)
    const records = config.get<Record<string, number>>('tabHistory.records', {})

    let hasChanged = false

    if (
      this._enabled !== enabled ||
      this._size !== size
    ) {
      this._enabled = enabled
      this._size = size

      hasChanged = true
    }

    if (!areObjectsShallowEqual(this._records, records)) {
      this._records = records

      hasChanged = true
    }

    return hasChanged
  }

  async save() {
    const config = getConfig()
    await config.update('tabHistory.records', this._records)
  }

  get enabled() {
    return this._enabled
  }

  get size() {
    return this._size
  }

  set records(value: Record<string, number>) {
    this._records = value
  }

  get records() {
    return this._records
  }
}
