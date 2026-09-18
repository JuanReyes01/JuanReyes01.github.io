import { describe, it, expect, vi } from 'vitest';
import { createWaveformAction } from './waveform';
import { WaveformEngine } from '../engines/waveform';
import type { CanvasActionDeps } from '../runtime/canvas-action';
import { Scheduler, type SchedulerClock } from '../runtime/scheduler';

function fakeDeps(): CanvasActionDeps {
	const clock: SchedulerClock = {
		now: () => 0,
		requestFrame: () => 1,
		cancelFrame: () => {},
		isHidden: () => false
	};
	return {
		scheduler: new Scheduler(clock),
		themeWatcher: { get: () => ({}) as never, subscribe: () => () => {}, destroy: () => {} },
		reducedMotionWatcher: { get: () => false, subscribe: () => () => {}, destroy: () => {} },
		loadFonts: () => Promise.resolve(),
		now: () => 0
	};
}

function fakeCanvas() {
	const ctx = {
		font: '',
		textBaseline: '',
		fillStyle: '',
		setTransform: () => {},
		clearRect: () => {},
		fillText: () => {},
		measureText: () => ({ width: 7 })
	};
	const listeners: Record<string, Array<(e: unknown) => void>> = {};
	return {
		getContext: () => ctx,
		getBoundingClientRect: () => ({ width: 1200, height: 60, top: 0, left: 0 }),
		addEventListener: (type: string, cb: (e: unknown) => void) => {
			(listeners[type] ??= []).push(cb);
		},
		removeEventListener: (type: string, cb: (e: unknown) => void) => {
			listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
		},
		fire: (type: string, event: unknown) => listeners[type]?.forEach((cb) => cb(event))
	} as unknown as HTMLCanvasElement & { fire: (type: string, event: unknown) => void };
}

describe('createWaveformAction', () => {
	it('forwards pointermove X position to the engine as a poke', async () => {
		const pokeSpy = vi.spyOn(WaveformEngine.prototype, 'poke');
		const canvas = fakeCanvas();
		const attach = createWaveformAction(fakeDeps());
		attach(canvas, { section: 'work' });
		await Promise.resolve();
		await Promise.resolve();

		canvas.fire('pointermove', { clientX: 300, clientY: 20 });
		expect(pokeSpy).toHaveBeenCalledWith(300, expect.any(Number));
		pokeSpy.mockRestore();
	});

	it('exposes setSignature() on the handle, forwarding to the engine', async () => {
		const setSignatureSpy = vi.spyOn(WaveformEngine.prototype, 'setSignature');
		const canvas = fakeCanvas();
		const attach = createWaveformAction(fakeDeps());
		const handle = attach(canvas, { section: 'work' });
		await Promise.resolve();
		await Promise.resolve();

		const sig = { amplitude: 0.5, frequency: 2, waveCount: 2 };
		handle.setSignature(sig);
		expect(setSignatureSpy).toHaveBeenCalledWith(sig);
		setSignatureSpy.mockRestore();
	});

	it('exposes resetSignature() on the handle, forwarding to the engine', async () => {
		const resetSpy = vi.spyOn(WaveformEngine.prototype, 'resetSignature');
		const canvas = fakeCanvas();
		const attach = createWaveformAction(fakeDeps());
		const handle = attach(canvas, { section: 'work' });
		await Promise.resolve();
		await Promise.resolve();

		handle.resetSignature();
		expect(resetSpy).toHaveBeenCalled();
		resetSpy.mockRestore();
	});

	it('setSignature()/resetSignature() before the engine exists (fonts still loading) do not throw', () => {
		const canvas = fakeCanvas();
		const attach = createWaveformAction(fakeDeps());
		const handle = attach(canvas, { section: 'work' });
		expect(() => handle.setSignature({ amplitude: 0.5, frequency: 2, waveCount: 2 })).not.toThrow();
		expect(() => handle.resetSignature()).not.toThrow();
	});

	it('exposes setPalette() on the handle, forwarding to the engine', async () => {
		const setPaletteSpy = vi.spyOn(WaveformEngine.prototype, 'setPalette');
		const canvas = fakeCanvas();
		const attach = createWaveformAction(fakeDeps());
		const handle = attach(canvas, { section: 'work' });
		await Promise.resolve();
		await Promise.resolve();

		const pair: ['cyan', 'blue'] = ['cyan', 'blue'];
		handle.setPalette(pair);
		expect(setPaletteSpy).toHaveBeenCalledWith(pair);
		setPaletteSpy.mockRestore();
	});

	it('exposes resetPalette() on the handle, forwarding to the engine', async () => {
		const resetPaletteSpy = vi.spyOn(WaveformEngine.prototype, 'resetPalette');
		const canvas = fakeCanvas();
		const attach = createWaveformAction(fakeDeps());
		const handle = attach(canvas, { section: 'work' });
		await Promise.resolve();
		await Promise.resolve();

		handle.resetPalette();
		expect(resetPaletteSpy).toHaveBeenCalled();
		resetPaletteSpy.mockRestore();
	});

	it('setPalette()/resetPalette() before the engine exists (fonts still loading) do not throw', () => {
		const canvas = fakeCanvas();
		const attach = createWaveformAction(fakeDeps());
		const handle = attach(canvas, { section: 'work' });
		expect(() => handle.setPalette(['cyan', 'blue'])).not.toThrow();
		expect(() => handle.resetPalette()).not.toThrow();
	});

	it('destroy() detaches the pointer/touch listeners', async () => {
		const pokeSpy = vi.spyOn(WaveformEngine.prototype, 'poke');
		const canvas = fakeCanvas();
		const attach = createWaveformAction(fakeDeps());
		const handle = attach(canvas, { section: 'work' });
		await Promise.resolve();
		await Promise.resolve();

		handle.destroy();
		canvas.fire('pointermove', { clientX: 1, clientY: 1 });
		expect(pokeSpy).not.toHaveBeenCalled();
		pokeSpy.mockRestore();
	});
});
