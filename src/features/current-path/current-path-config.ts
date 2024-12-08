import { ConfigurationTarget } from 'vscode'
import { getConfig, initialConfig, updateEffectiveConfig } from '../../config'
import { FeatureConfig } from '../feature-config'

const defaultMaxLabelLength = 60

export class CurrentPathConfig extends FeatureConfig {
  private _maxLabelLength: number = defaultMaxLabelLength

  constructor() {
    super('CurrentPath')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const maxLabelLength = config.get<number>('currentPath.maxLabelLength', defaultMaxLabelLength)

    let hasChanged = false

    if (this._maxLabelLength !== maxLabelLength) {
      this._maxLabelLength = maxLabelLength

      hasChanged = true
    }

    console.debug(`[CurrentPath] Config has been loaded (hasChanged: ${hasChanged})`, { maxLabelLength })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'currentPath.maxLabelLength',
      exists => (exists || this._maxLabelLength !== defaultMaxLabelLength) ? this._maxLabelLength : undefined
    )

    console.debug('[CurrentPath] Config has been saved')
  }

  getMaxLabelLength() {
    return this._maxLabelLength
  }
}