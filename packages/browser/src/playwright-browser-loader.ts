import { createRequire } from 'node:module';

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

import type {
  BrowserCapture,
  BrowserCaptureData,
  BrowserLoader,
  BrowserLoadRequest,
  BrowserLoadResult,
} from './types.js';

const require = createRequire(import.meta.url);
const playwrightPackage = require('playwright/package.json') as { version: string };

export const DEFAULT_NAVIGATION_TIMEOUT_MS = 15_000;
export const PLAYWRIGHT_AUTOMATION_NAME = 'playwright';
export const PLAYWRIGHT_AUTOMATION_VERSION = playwrightPackage.version;

type Clock = () => Date;

type LaunchBrowser = () => Promise<Browser>;

export type PlaywrightBrowserLoaderOptions = {
  clock?: Clock;
  launchBrowser?: LaunchBrowser;
  defaultTimeoutMs?: number;
};

class PlaywrightBrowserCapture implements BrowserCapture {
  #closed = false;

  constructor(
    readonly data: BrowserCaptureData,
    private readonly page: Page,
    private readonly context: BrowserContext,
    private readonly browser: Browser,
  ) {}

  get closed(): boolean {
    return this.#closed;
  }

  async injectScript(content: string): Promise<void> {
    if (this.#closed) {
      throw new Error('Browser capture is closed.');
    }
    await this.page.addScriptTag({ content });
  }

  async evaluate<T>(expression: string): Promise<T> {
    if (this.#closed) {
      throw new Error('Browser capture is closed.');
    }
    return (await this.page.evaluate(expression)) as T;
  }

  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await closePlaywrightResources(this.page, this.context, this.browser);
  }
}

export class PlaywrightBrowserLoader implements BrowserLoader {
  readonly #clock: Clock;
  readonly #launchBrowser: LaunchBrowser;
  readonly #defaultTimeoutMs: number;

  constructor(options: PlaywrightBrowserLoaderOptions = {}) {
    this.#clock = options.clock ?? (() => new Date());
    this.#launchBrowser = options.launchBrowser ?? (() => chromium.launch({ headless: true }));
    this.#defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS;
  }

  async load(request: BrowserLoadRequest): Promise<BrowserLoadResult> {
    const attemptedAt = this.#clock().toISOString();
    let stage: 'browser_launch' | 'navigation' | 'page_metadata' = 'browser_launch';
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;

    try {
      browser = await this.#launchBrowser();
      context = await browser.newContext();
      page = await context.newPage();

      stage = 'navigation';
      const response = await page.goto(request.url, {
        timeout: request.timeoutMs ?? this.#defaultTimeoutMs,
        waitUntil: 'load',
      });

      stage = 'page_metadata';
      const [title, language, responseHeaders] = await Promise.all([
        page.title(),
        page.locator('html').getAttribute('lang'),
        response?.allHeaders() ?? Promise.resolve({}),
      ]);

      const data: BrowserCaptureData = {
        requestedUrl: request.url,
        finalUrl: page.url(),
        title,
        language: normalizeLanguage(language),
        loadedAt: this.#clock().toISOString(),
        browserName: 'chromium',
        browserVersion: browser.version(),
        automationName: PLAYWRIGHT_AUTOMATION_NAME,
        automationVersion: PLAYWRIGHT_AUTOMATION_VERSION,
        navigation: {
          httpStatus: response?.status() ?? null,
          responseHeaders,
        },
      };

      return {
        status: 'loaded',
        capture: new PlaywrightBrowserCapture(data, page, context, browser),
      };
    } catch (error) {
      await closePlaywrightResources(page, context, browser);
      const normalized = normalizeError(error);
      return {
        status: 'failed',
        requestedUrl: request.url,
        attemptedAt,
        automationName: PLAYWRIGHT_AUTOMATION_NAME,
        automationVersion: PLAYWRIGHT_AUTOMATION_VERSION,
        error: { stage, ...normalized },
      };
    }
  }
}

function normalizeLanguage(language: string | null): string | null {
  const normalized = language?.trim();
  return normalized ? normalized : null;
}

function normalizeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name.trim() || 'Error',
      message: error.message.trim() || 'Unknown browser error.',
    };
  }
  return { name: 'Error', message: String(error) || 'Unknown browser error.' };
}

async function closePlaywrightResources(
  page: Page | undefined,
  context: BrowserContext | undefined,
  browser: Browser | undefined,
): Promise<void> {
  let firstFailure: unknown;
  const closers = [
    page === undefined ? undefined : () => page.close(),
    context === undefined ? undefined : () => context.close(),
    browser === undefined ? undefined : () => browser.close(),
  ];

  for (const close of closers) {
    if (!close) continue;
    try {
      await close();
    } catch (error) {
      firstFailure ??= error;
    }
  }

  if (firstFailure !== undefined) {
    throw firstFailure;
  }
}
