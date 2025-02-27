import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config'
import { FeatureConfig } from '../feature-config'
import z from 'zod'

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
    const maxLabelLength = safeConfigGet(config, 'currentPath.maxLabelLength', defaultMaxLabelLength, z.number().nonnegative())
    const collapsedIndicator = safeConfigGet(config, 'currentPath.collapsedIndicator', defaultCollapsedIndicator, z.string())

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