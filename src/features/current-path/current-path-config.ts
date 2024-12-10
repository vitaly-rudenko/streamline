import { ConfigurationTarget } from 'vscode'
import { getConfig, initialConfig, updateEffectiveConfig } from '../../config'
import { FeatureConfig } from '../feature-config'

const defaultMaxLabelLength = 60
const defaultCollapsedIndicator = '⸱⸱⸱'

export class CurrentPathConfig extends FeatureConfig {
  private _maxLabelLength: number = defaultMaxLabelLength
  private _collapsedIndicator: string = defaultCollapsedIndicator

  constructor() {
    super('CurrentPath')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const maxLabelLength = config.get<number>('currentPath.maxLabelLength', defaultMaxLabelLength)
    const collapsedIndicator = config.get<string>('currentPath.collapsedIndicator', defaultCollapsedIndicator)

    let hasChanged = false

    if (
      this._maxLabelLength !== maxLabelLength
      || this._collapsedIndicator !== collapsedIndicator
    ) {
      this._maxLabelLength = maxLabelLength
      this._collapsedIndicator = collapsedIndicator

      hasChanged = true
    }

    console.debug(`[CurrentPath] Config has been loaded (hasChanged: ${hasChanged})`, { maxLabelLength, collapsedIndicator })

    return hasChanged
  }

  async save() { /* noop */ }

  getMaxLabelLength() {
    return this._maxLabelLength
  }

  getCollapsedIndicator() {
    return this._collapsedIndicator
  }
}