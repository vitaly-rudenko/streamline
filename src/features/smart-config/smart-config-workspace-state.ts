import { Memento } from 'vscode'

export class SmartConfigWorkspaceState {
    private _enabledToggles: string[] = []

    constructor(
        private readonly workspaceState: Memento
    ) {
        this.load()
    }

    private load() {
        const enabledToggles = this.workspaceState.get<string[]>('streamline.smartConfig.enabledToggles', [])

        this._enabledToggles = enabledToggles

        console.debug('[SmartConfig] WorkspaceState has been loaded', { enabledToggles })
    }

    async save() {
        await this.workspaceState.update(
            'streamline.smartConfig.enabledToggles',
            this._enabledToggles.length > 0 ? this._enabledToggles : undefined,
        )

        console.debug('[SmartConfig] WorkspaceState has been saved')
    }

    setEnabledToggles(value: string[]) {
        this._enabledToggles = value
    }

    getEnabledToggles() {
        return this._enabledToggles
    }
}