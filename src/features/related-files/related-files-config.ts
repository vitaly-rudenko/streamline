import { ConfigurationTarget } from 'vscode'
import { getConfig, initialConfig, updateEffectiveConfig } from '../../config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'
import { FeatureConfig } from '../feature-config'

const defaultUseExcludes = true
const defaultUseStricterQuickOpenQuery = false
const defaultUseGlobalSearch = false
const defaultMaxLabelLength = 60
const defaultCollapsedIndicator = '⸱⸱⸱'
const defaultExcludedSuffixes = ['js', 'ts', 'mjs', 'mts', 'rb', 'spec', 'test', 'e2e-spec']

export class RelatedFilesConfig extends FeatureConfig {
  private _customExcludes: Record<string, unknown> = {}
  private _useExcludes: boolean = defaultUseExcludes
  private _useStricterQuickOpenQuery: boolean = defaultUseStricterQuickOpenQuery
  private _useGlobalSearch: boolean = defaultUseGlobalSearch
  private _hiddenWorkspaceFoldersInGlobalSearch: string[] = []
  private _maxLabelLength: number = defaultMaxLabelLength
  private _collapsedIndicator: string = defaultCollapsedIndicator
  private _excludedSuffixes: string[] = defaultExcludedSuffixes

  constructor() {
    super('RelatedFiles')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const customExcludes = config.get<Record<string, unknown>>('relatedFiles.exclude', {})
    const useExcludes = config.get<boolean>('relatedFiles.useExcludes', defaultUseExcludes)
    const useStricterQuickOpenQuery = config.get<boolean>('relatedFiles.useStricterQuickOpenQuery', defaultUseStricterQuickOpenQuery)
    const useGlobalSearch = config.get<boolean>('relatedFiles.useGlobalSearch', defaultUseGlobalSearch)
    const hiddenWorkspaceFoldersInGlobalSearch = config.get<string[]>('relatedFiles.hiddenWorkspaceFoldersInGlobalSearch', [])
    const maxLabelLength = config.get<number>('relatedFiles.maxLabelLength', defaultMaxLabelLength)
    const collapsedIndicator = config.get<string>('relatedFiles.collapsedIndicator', defaultCollapsedIndicator)
    const excludedSuffixes = config.get<string[]>('relatedFiles.excludedSuffixes', defaultExcludedSuffixes)

    let hasChanged = false

    if (
      this._useExcludes !== useExcludes
      || this._useStricterQuickOpenQuery !== useStricterQuickOpenQuery
      || this._useGlobalSearch !== useGlobalSearch
      || this._maxLabelLength !== maxLabelLength
      || this._collapsedIndicator !== collapsedIndicator
      || !areObjectsShallowEqual(this._customExcludes, customExcludes)
      || !areArraysShallowEqual(this._hiddenWorkspaceFoldersInGlobalSearch, hiddenWorkspaceFoldersInGlobalSearch)
      || !areArraysShallowEqual(this._excludedSuffixes, excludedSuffixes)
    ) {
      this._useExcludes = useExcludes
      this._useStricterQuickOpenQuery = useStricterQuickOpenQuery
      this._useGlobalSearch = useGlobalSearch
      this._maxLabelLength = maxLabelLength
      this._collapsedIndicator = collapsedIndicator
      this._customExcludes = customExcludes
      this._hiddenWorkspaceFoldersInGlobalSearch = hiddenWorkspaceFoldersInGlobalSearch
      this._excludedSuffixes = excludedSuffixes

      hasChanged = true
    }

    console.debug(`[RelatedFiles] Config has been loaded (hasChanged: ${hasChanged})`, {
      useExcludes,
      useStricterQuickOpenQuery,
      useGlobalSearch,
      maxLabelLength,
      collapsedIndicator,
      customExcludes,
      hiddenWorkspaceFoldersInGlobalSearch,
      excludedSuffixes,
    })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'relatedFiles.useExcludes',
      exists => (exists || this._useExcludes !== defaultUseExcludes) ? this._useExcludes : undefined,
    )

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'relatedFiles.useGlobalSearch',
      exists => (exists || this._useGlobalSearch !== defaultUseGlobalSearch) ? this._useGlobalSearch : undefined,
    )

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Workspace,
      'relatedFiles.hiddenWorkspaceFoldersInGlobalSearch',
      exists => (exists || this._hiddenWorkspaceFoldersInGlobalSearch.length > 0) ? this._hiddenWorkspaceFoldersInGlobalSearch : undefined,
    )

    console.debug('[RelatedFiles] Config has been saved')
  }

  getExcludedSuffixes() {
    return this._excludedSuffixes
  }

  getCustomExcludes() {
    return this._customExcludes
  }

  getUseStricterQuickOpenQuery() {
    return this._useStricterQuickOpenQuery
  }

  getMaxLabelLength() {
    return this._maxLabelLength
  }

  getCollapsedIndicator() {
    return this._collapsedIndicator
  }

  setHiddenWorkspaceFoldersInGlobalSearch(value: string[]) {
    this._hiddenWorkspaceFoldersInGlobalSearch = value
  }

  getHiddenWorkspaceFoldersInGlobalSearch() {
    return this._hiddenWorkspaceFoldersInGlobalSearch
  }

  setUseGlobalSearch(value: boolean) {
    this._useGlobalSearch = value
  }

  getUseGlobalSearch() {
    return this._useGlobalSearch
  }

  setUseExcludes(value: boolean) {
    this._useExcludes = value
  }

  getUseExcludes() {
    return this._useExcludes
  }
}
