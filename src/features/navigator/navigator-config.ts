import { ConfigurationTarget } from 'vscode'
import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config'
import { FeatureConfig } from '../feature-config'
import z from 'zod'

const defaultReuseRecordsOffset = 1

export class NavigatorConfig extends FeatureConfig {
  private _reuseRecordsOffset: number = defaultReuseRecordsOffset

  constructor() {
    super('Navigator')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const reuseRecordsOffset = safeConfigGet(config, 'navigator.reuseRecordsOffset', defaultReuseRecordsOffset, z.number())

    let hasChanged = false

    if (this._reuseRecordsOffset !== reuseRecordsOffset) {
      this._reuseRecordsOffset = reuseRecordsOffset

      hasChanged = true
    }

    console.debug('[Navigator] Config has been loaded', { hasChanged, reuseRecordsOffset })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'navigator.reuseRecordsOffset',
      exists => (exists || this._reuseRecordsOffset !== defaultReuseRecordsOffset) ? this._reuseRecordsOffset : undefined,
    )

    console.debug('[Navigator] Config has been saved')
  }

  getReuseRecordsOffset() {
    return this._reuseRecordsOffset
  }
}