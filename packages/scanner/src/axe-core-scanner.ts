import axe from 'axe-core';

import { jsonValueSchema } from '@accessledger/shared';

import type { AccessibilityScanner, ScannerCapture } from './types.js';

type Clock = () => Date;

export type AxeCoreScannerOptions = {
  clock?: Clock;
};

export class AxeCoreScanner implements AccessibilityScanner {
  readonly name = 'axe-core';
  readonly version = axe.version;
  readonly #clock: Clock;

  constructor(options: AxeCoreScannerOptions = {}) {
    this.#clock = options.clock ?? (() => new Date());
  }

  async scan(capture: Parameters<AccessibilityScanner['scan']>[0]): Promise<ScannerCapture> {
    try {
      await capture.injectScript(axe.source);
    } catch (error) {
      return this.failure('axe_injection', error);
    }

    try {
      const serializedResult = await capture.evaluate<string>(
        '(async () => JSON.stringify(await globalThis.axe.run(document)))()',
      );
      const rawResult: unknown = JSON.parse(serializedResult);
      return {
        status: 'completed',
        capturedAt: this.#clock().toISOString(),
        scannerName: this.name,
        scannerVersion: this.version,
        rawResult: jsonValueSchema.parse(rawResult),
      };
    } catch (error) {
      return this.failure('axe_execution', error);
    }
  }

  private failure(
    stage: 'axe_injection' | 'axe_execution',
    error: unknown,
  ): Extract<ScannerCapture, { status: 'failed' }> {
    const normalized = normalizeError(error);
    return {
      status: 'failed',
      capturedAt: this.#clock().toISOString(),
      scannerName: this.name,
      scannerVersion: this.version,
      error: { stage, ...normalized },
    };
  }
}

function normalizeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name.trim() || 'Error',
      message: error.message.trim() || 'Unknown scanner error.',
    };
  }
  return { name: 'Error', message: String(error) || 'Unknown scanner error.' };
}
