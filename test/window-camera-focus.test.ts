import { describe, expect, it } from 'vitest';
import { focusWindowOnSelect } from '../src/core/config/helios-config';
import { SceneCamera } from '../src/scene/projection';
import {
    cameraBearingForFacade,
    resolveWindowFocusBearing,
    shouldFocusWindowOnSelection,
    shortestBearingDelta,
    WindowCameraFocusAnimator,
    type CameraAnimationScheduler,
} from '../src/scene/window-camera-focus.ts';

class AnimationFrameHarness implements CameraAnimationScheduler
{
    private _nextId = 0;
    private readonly _callbacks = new Map<number, (time: number) => void>();

    public request(callback: (time: number) => void): number
    {
        const id = ++this._nextId;
        this._callbacks.set(id, callback);
        return id;
    }

    public cancel(id: number): void
    {
        this._callbacks.delete(id);
    }

    public frame(time: number): void
    {
        const callbacks = [...this._callbacks.values()];
        this._callbacks.clear();
        callbacks.forEach((callback) => callback(time));
    }
}

describe('focusWindowOnSelect', () =>
{
    it('is disabled by default and enables only when explicitly true', () =>
    {
        expect(focusWindowOnSelect(undefined)).toBe(false);
        expect(focusWindowOnSelect({})).toBe(false);
        expect(focusWindowOnSelect({ 'focus-window-on-select': false })).toBe(false);
        expect(focusWindowOnSelect({ 'focus-window-on-select': true })).toBe(true);
    });
});

describe('window camera bearing', () =>
{
    it('requests focus only when enabled and the active selection changes', () =>
    {
        expect(shouldFocusWindowOnSelection(true, true)).toBe(true);
        expect(shouldFocusWindowOnSelection(true, false)).toBe(false);
        expect(shouldFocusWindowOnSelection(false, true)).toBe(false);
    });

    it('does not resolve a focus target when disabled, locked, or missing geometry', () =>
    {
        expect(resolveWindowFocusBearing(180, false, false)).toBeNull();
        expect(resolveWindowFocusBearing(180, true, true)).toBeNull();
        expect(resolveWindowFocusBearing(null, true, false)).toBeNull();
        expect(resolveWindowFocusBearing(180, true, false)).toBe(0);
    });

    it.each([
        [0, 180],
        [90, 90],
        [180, 0],
        [270, 270],
        [360, 180],
        [-90, 270],
    ])('faces the exterior side of a %i-degree facade at bearing %i', (azimuth, expected) =>
    {
        expect(cameraBearingForFacade(azimuth)).toBe(expected);
    });

    it.each([0, 90, 180, 270])('places the %i-degree facade on the camera-near side', (azimuth) =>
    {
        const camera = new SceneCamera();
        camera.setPose(cameraBearingForFacade(azimuth)!, 50);
        camera.setViewport(800, 600);
        const radians = azimuth * Math.PI / 180;
        const point = camera.project3(Math.sin(radians) * 10, Math.cos(radians) * 10, 0);

        expect(point.depth).toBeGreaterThan(0);
    });

    it('returns the shortest signed delta across north and resolves a half-turn consistently', () =>
    {
        expect(shortestBearingDelta(350, 10)).toBe(20);
        expect(shortestBearingDelta(10, 350)).toBe(-20);
        expect(shortestBearingDelta(0, 180)).toBe(-180);
    });
});

describe('WindowCameraFocusAnimator', () =>
{
    it('interpolates across north and completes at the normalized target', () =>
    {
        const frames = new AnimationFrameHarness();
        const animator = new WindowCameraFocusAnimator(frames, 100);
        const bearings: number[] = [];
        let completed = 0;

        animator.animate(350, 10, (bearing) => bearings.push(bearing), () => completed++);
        frames.frame(100);
        frames.frame(150);
        expect(bearings.at(-1)).toBeCloseTo(7.5);
        frames.frame(200);

        expect(bearings.at(-1)).toBe(10);
        expect(completed).toBe(1);
    });

    it('replaces an active target and does not complete the canceled animation', () =>
    {
        const frames = new AnimationFrameHarness();
        const animator = new WindowCameraFocusAnimator(frames, 100);
        let oldCompleted = 0;
        const newBearings: number[] = [];

        animator.animate(0, 90, () => undefined, () => oldCompleted++);
        frames.frame(0);
        animator.animate(0, 270, (bearing) => newBearings.push(bearing));
        frames.frame(50);
        frames.frame(150);

        expect(oldCompleted).toBe(0);
        expect(newBearings.at(-1)).toBe(270);
    });

    it('cancels pending frames without invoking completion', () =>
    {
        const frames = new AnimationFrameHarness();
        const animator = new WindowCameraFocusAnimator(frames, 100);
        const bearings: number[] = [];
        let completed = false;

        animator.animate(0, 90, (bearing) => bearings.push(bearing), () => completed = true);
        frames.frame(0);
        animator.cancel();
        frames.frame(100);

        expect(bearings).toEqual([0]);
        expect(completed).toBe(false);
    });
});