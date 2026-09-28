import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PlaywrightBrowserLoader } from '../src/index.js';
import { startFixtureServer, type FixtureServer } from './support/fixture-server.js';

describe('PlaywrightBrowserLoader', () => {
  let fixtureServer: FixtureServer | undefined;

  beforeAll(async () => {
    fixtureServer = await startFixtureServer();
  });

  afterAll(async () => {
    if (!fixtureServer) return;
    await fixtureServer.close();
    expect(fixtureServer.closed).toBe(true);
  });

  it('captures final URL and metadata after a redirect, then closes owned resources', async () => {
    if (!fixtureServer) throw new Error('Fixture server is unavailable.');
    const browsers: Browser[] = [];
    const loader = new PlaywrightBrowserLoader({
      launchBrowser: async () => {
        const browser = await chromium.launch({ headless: true });
        browsers.push(browser);
        return browser;
      },
    });

    const result = await loader.load({ url: `${fixtureServer.origin}/redirect` });

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;

    expect(result.capture.data).toMatchObject({
      requestedUrl: `${fixtureServer.origin}/redirect`,
      finalUrl: `${fixtureServer.origin}/good-form.html`,
      title: 'Good form fixture',
      language: 'en',
      browserName: 'chromium',
      navigation: { httpStatus: 200 },
    });
    expect(result.capture.closed).toBe(false);

    await result.capture.close();
    await result.capture.close();

    expect(result.capture.closed).toBe(true);
    expect(browsers).toHaveLength(1);
    expect(browsers[0]?.isConnected()).toBe(false);
  });

  it('returns a typed navigation failure and closes resources on the failure path', async () => {
    if (!fixtureServer) throw new Error('Fixture server is unavailable.');
    const browsers: Browser[] = [];
    const loader = new PlaywrightBrowserLoader({
      launchBrowser: async () => {
        const browser = await chromium.launch({ headless: true });
        browsers.push(browser);
        return browser;
      },
    });

    const result = await loader.load({
      url: `${fixtureServer.origin}/close-connection`,
      timeoutMs: 2_000,
    });

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.error.stage).toBe('navigation');
    expect(result.error.message).not.toHaveLength(0);
    expect(browsers).toHaveLength(1);
    expect(browsers[0]?.isConnected()).toBe(false);
  });
});
