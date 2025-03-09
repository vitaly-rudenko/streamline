import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'
import { FeatureConfig } from '../feature-config'
import z from 'zod'

const defaultCustomExcludes = {
  '**/*.snap': true,
  '**/*.map': true
}

export class RelatedFilesConfig extends FeatureConfig {
  private _customExcludes: Record<string, unknown> = {}

  constructor() {
    super('RelatedFiles')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const customExcludes = safeConfigGet(config, 'relatedFiles.exclude', defaultCustomExcludes, z.record(z.unknown()))

    let hasChanged = false

    if (
      !areObjectsShallowEqual(this._customExcludes, customExcludes)
    ) {
      this._customExcludes = customExcludes

      hasChanged = true
    }

    console.debug(`[RelatedFiles] Config has been loaded (hasChanged: ${hasChanged})`, {
      customExcludes,
    })

    return hasChanged
  }

  async save() {}

  getCustomExcludes() {
    return this._customExcludes
  }
}
