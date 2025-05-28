export abstract class FeatureConfig {
  private _saveQueue = Promise.resolve()
  private _isSaving = false

  constructor(private readonly featureName: string) {}

  abstract load(): boolean
  abstract save(): Promise<void>

  async saveInQueue() {
    this._saveQueue = this._saveQueue
      .then(() => {
        this._isSaving = true
        return this.save()
      })
      .catch((error) => console.warn(`[${this.featureName}] Could not save config`, error))
      .finally(() => this._isSaving = false)

    return this._saveQueue
  }

  get isSaving() {
    return this._isSaving
  }
}
