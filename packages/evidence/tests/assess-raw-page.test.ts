import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PlaywrightBrowserLoader } from '@accessledger/browser';
import { AxeCoreScanner, type AccessibilityScanner } from '@accessledger/scanner';
import {
  CONTRACT_SCHEMA_VERSION,
  rawPageAssessmentSchema,
  type JsonValue,
} from '@accessledger/shared';

import {
  startFixtureServer,
  type FixtureServer,
} from '../../browser/tests/support/fixture-server.js';
import { assessRawPage } from '../src/index.js';

describe('assessRawPage', () => {
  let fixtureServer: FixtureServer | undefined;

  beforeAll(async () => {
    fixtureServer = await startFixtureServer();
  });

  afterAll(async () => {
    if (!fixtureServer) return;
    await fixtureServer.close();
    expect(fixtureServer.closed).toBe(true);
  });

  it.each([
    ['good-form.html', null, null],
    ['unlabeled-input.html', 'label', '#email'],
    ['empty-button.html', 'button-name', '#empty-action'],
    ['broken-aria.html', 'aria-valid-attr-value', '#broken-state'],
  ] as const)(
    'runs axe-core against deterministic fixture %s',
    async (fixtureName, expectedRule, expectedSelector) => {
      if (!fixtureServer) throw new Error('Fixture server is unavailable.');
      const browsers: Browser[] = [];
      const result = await assessRawPage(
        {
          assessmentId: 'assessment-fixtures',
          url: `${fixtureServer.origin}/${fixtureName}`,
        },
        {
          browserLoader: trackingLoader(browsers),
          scanner: new AxeCoreScanner(),
        },
      );

      expect(result.operationalResult).toEqual({ status: 'loaded' });
      expect(result.page.loadStatus).toBe('loaded');
      expect(result.scannerEvidence?.source).toMatchObject({
        type: 'scanner',
        name: 'axe-core',
      });

      const payload = asRecord(result.scannerEvidence?.payload);
      const violations = payload.violations as Array<Record<string, unknown>>;
      if (expectedRule === null) {
        expect(violations).toEqual([]);
      } else {
        const violation = violations.find((item) => item.id === expectedRule);
        expect(violation).toBeDefined();
        const nodes = violation?.nodes as Array<Record<string, unknown>>;
        expect(nodes[0]?.target).toContain(expectedSelector);
        expect(nodes[0]?.html).toContain(expectedSelector.slice(1));
      }

      expect(browsers).toHaveLength(1);
      expect(browsers[0]?.isConnected()).toBe(false);
    },
  );

  it('preserves a scanner result payload exactly and survives a JSON round trip', async () => {
    if (!fixtureServer) throw new Error('Fixture server is unavailable.');
    const rawResult = {
      testEngine: { name: 'axe-core', version: 'fixture-version' },
      violations: [
        {
          id: 'button-name',
          impact: 'critical',
          help: 'Buttons must have discernible text',
          helpUrl: 'https://example.test/rules/button-name',
          nodes: [
            {
              impact: 'critical',
              target: [['#shadow-root'], ['button[data-action="save"]']],
              html: '<button data-action="save"></button>',
              failureSummary: 'Fix the accessible name.',
              any: [{ id: 'has-visible-text', data: null, message: 'No text.' }],
              all: [],
              none: [],
            },
          ],
        },
      ],
      passes: [],
      incomplete: [],
      inapplicable: [],
    } satisfies JsonValue;
    const scanner: AccessibilityScanner = {
      name: 'lossless-fixture-scanner',
      version: '1.2.3',
      async scan() {
        return {
          status: 'completed',
          capturedAt: '2026-09-28T12:00:01.000Z',
          scannerName: this.name,
          scannerVersion: this.version,
          rawResult,
        };
      },
    };

    const result = await assessRawPage(
      {
        assessmentId: 'assessment-lossless',
        url: `${fixtureServer.origin}/empty-button.html`,
      },
      { scanner },
    );

    expect(result.scannerEvidence?.payload).toEqual(rawResult);
    const parsed = rawPageAssessmentSchema.parse(JSON.parse(JSON.stringify(result)));
    expect(parsed).toEqual(result);
    expect(parsed.scannerEvidence?.payload).toEqual(rawResult);
  });

  it('collects accessibility evidence in the existing lifecycle with complete traceability', async () => {
    if (!fixtureServer) throw new Error('Fixture server is unavailable.');
    const browsers: Browser[] = [];
    const result = await assessRawPage(
      {
        assessmentId: 'assessment-accessibility',
        url: `${fixtureServer.origin}/accessibility-semantics.html`,
        accessibilityTargets: [
          {
            schemaVersion: CONTRACT_SCHEMA_VERSION,
            id: 'email-target',
            strategy: 'css',
            selector: '#email',
            sourceEvidenceId: 'scanner-evidence-1',
          },
        ],
      },
      {
        browserLoader: trackingLoader(browsers),
        idFactory: (recordType) => `${recordType}-1`,
      },
    );

    expect(result.operationalResult).toEqual({ status: 'loaded' });
    expect(result.accessibilityEvidence).toHaveLength(1);
    expect(result.page.rawEvidenceIds).toEqual([
      'browser-evidence-1',
      'scanner-evidence-1',
      'accessibility-evidence-1',
    ]);
    expect(result.accessibilityEvidence[0]).toMatchObject({
      id: 'accessibility-evidence-1',
      assessmentId: 'assessment-accessibility',
      pageId: 'page-1',
      kind: 'accessibility_semantics',
      metadata: {
        targetId: 'email-target',
        rawEvidenceIds: ['browser-evidence-1', 'scanner-evidence-1'],
        sourceEvidenceId: 'scanner-evidence-1',
      },
      payload: {
        collectionStatus: 'collected',
        provenance: {
          classification: 'browser_accessibility_semantics',
          assistiveTechnologyOutput: false,
        },
      },
    });
    expect(rawPageAssessmentSchema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result);
    expect(browsers).toHaveLength(1);
    expect(browsers[0]?.isConnected()).toBe(false);
  });

  it('records navigation failure as operational evidence without scanner output', async () => {
    if (!fixtureServer) throw new Error('Fixture server is unavailable.');
    const result = await assessRawPage(
      {
        assessmentId: 'assessment-failure',
        url: `${fixtureServer.origin}/close-connection`,
      },
      { navigationTimeoutMs: 2_000 },
    );

    expect(result.operationalResult.status).toBe('navigation_failed');
    expect(result.page).toMatchObject({
      loadStatus: 'failed',
      finalUrl: null,
      loadedAt: null,
    });
    expect(result.scannerEvidence).toBeNull();
    expect(result.browserEvidence.payload).toMatchObject({ status: 'failed' });
  });

  it('records scanner failure separately while retaining the loaded Page', async () => {
    if (!fixtureServer) throw new Error('Fixture server is unavailable.');
    const browsers: Browser[] = [];
    const scanner: AccessibilityScanner = {
      name: 'failing-fixture-scanner',
      version: '1.0.0',
      async scan() {
        return {
          status: 'failed',
          capturedAt: '2026-09-28T12:00:01.000Z',
          scannerName: this.name,
          scannerVersion: this.version,
          error: {
            stage: 'axe_execution',
            name: 'FixtureScanError',
            message: 'Intentional scanner failure.',
          },
        };
      },
    };

    const result = await assessRawPage(
      {
        assessmentId: 'assessment-scan-failure',
        url: `${fixtureServer.origin}/good-form.html`,
      },
      { browserLoader: trackingLoader(browsers), scanner },
    );

    expect(result.operationalResult).toEqual({
      status: 'scan_failed',
      error: {
        stage: 'axe_execution',
        name: 'FixtureScanError',
        message: 'Intentional scanner failure.',
      },
    });
    expect(result.page.loadStatus).toBe('loaded');
    expect(result.scannerEvidence?.payload).toEqual({
      status: 'failed',
      error: {
        stage: 'axe_execution',
        name: 'FixtureScanError',
        message: 'Intentional scanner failure.',
      },
    });
    expect(browsers).toHaveLength(1);
    expect(browsers[0]?.isConnected()).toBe(false);
  });
});

function trackingLoader(browsers: Browser[]): PlaywrightBrowserLoader {
  return new PlaywrightBrowserLoader({
    launchBrowser: async () => {
      const browser = await chromium.launch({ headless: true });
      browsers.push(browser);
      return browser;
    },
  });
}

function asRecord(value: JsonValue | undefined): Record<string, JsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an object payload.');
  }
  return value;
}
