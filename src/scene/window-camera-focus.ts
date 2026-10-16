export interface CameraAnimationScheduler
{
    request(callback: (time: number) => void): number;
    cancel(id: number): void;
}

const browserScheduler: CameraAnimationScheduler = {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (id) => cancelAnimationFrame(id),
};

function normalizeBearing(bearing: number): number
{
    return ((bearing % 360) + 360) % 360;
}

export function cameraBearingForFacade(azimuthDeg: number): number | null
{
    return Number.isFinite(azimuthDeg) ? normalizeBearing(180 - azimuthDeg) : null;
}

export function resolveWindowFocusBearing(
    azimuthDeg: number | null | undefined,
    focusEnabled: boolean,
    cameraLocked: boolean
): number | null
{
    if (!focusEnabled || cameraLocked || typeof azimuthDeg !== 'number')
    {
        return null;
    }
    return cameraBearingForFacade(azimuthDeg);
}

export function shouldFocusWindowOnSelection(focusEnabled: boolean, selectionChanged: boolean): boolean
{
    return focusEnabled && selectionChanged;
}

export function shortestBearingDelta(fromBearing: number, toBearing: number): number
{
    const from = normalizeBearing(fromBearing);
    const to = normalizeBearing(toBearing);
    return ((to - from + 540) % 360) - 180;
}

export class WindowCameraFocusAnimator
{
    private _frameId: number | undefined;
    private _generation = 0;
    private readonly _durationMs: number;

    public constructor(
        private readonly _scheduler: CameraAnimationScheduler = browserScheduler,
        durationMs = 650
    )
    {
        this._durationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 650;
    }

    public animate(
        fromBearing: number,
        toBearing: number,
        onBearing: (bearing: number) => void,
        onComplete: () => void = () => undefined
    ): void
    {
        this.cancel();
        const generation = this._generation;
        const start = normalizeBearing(fromBearing);
        const target = normalizeBearing(toBearing);
        const delta = shortestBearingDelta(start, target);
        if (delta === 0)
        {
            onBearing(target);
            onComplete();
            return;
        }

        let startedAt: number | undefined;
        const tick = (time: number): void =>
        {
            if (generation !== this._generation)
            {
                return;
            }
            startedAt ??= time;
            const progress = Math.min(1, Math.max(0, (time - startedAt) / this._durationMs));
            const eased = 1 - (1 - progress) ** 3;
            onBearing(normalizeBearing(start + delta * eased));
            if (generation !== this._generation)
            {
                return;
            }
            if (progress >= 1)
            {
                this._frameId = undefined;
                onComplete();
                return;
            }
            this._frameId = this._scheduler.request(tick);
        };
        this._frameId = this._scheduler.request(tick);
    }

    public cancel(): boolean
    {
        const wasAnimating = this._frameId !== undefined;
        this._generation++;
        if (this._frameId !== undefined)
        {
            this._scheduler.cancel(this._frameId);
            this._frameId = undefined;
        }
        return wasAnimating;
    }
}