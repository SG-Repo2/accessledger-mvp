import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PlaywrightBrowserLoader } from '@accessledger/browser';
import {
  CONTRACT_SCHEMA_VERSION,
  accessibilitySemanticsEvidenceSchema,
  type AccessibilitySemanticsEvidence,
  type AccessibilityTargetDescriptor,
} from '@accessledger/shared';

import {
  startFixtureServer,
  type FixtureServer,
} from '../../browser/tests/support/fixture-server.js';
import { BrowserAccessibilityEvidenceCollector } from '../src/index.js';

type CollectedEvidence = Omit<AccessibilitySemanticsEvidence, 'payload'> & {
  payload: Extract<AccessibilitySemanticsEvidence['payload'], { collectionStatus: 'collected' }>;
};
type ErrorEvidence = Omit<AccessibilitySemanticsEvidence, 'payload'> & {
  payload: Extract<AccessibilitySemanticsEvidence['payload'], { collectionStatus: 'error' }>;
};

describe('BrowserAccessibilityEvidenceCollector', () => {
  let fixtureServer: FixtureServer | undefined;

  beforeAll(async () => {
    fixtureServer = await startFixtureServer();
  });

  afterAll(async () => {
    if (!fixtureServer) return;
    await fixtureServer.close();
    expect(fixtureServer.closed).toBe(true);
  });

  it('collects browser roles, names, values, states, focusability, and relationships', async () => {
    if (!fixtureServer) throw new Error('Fixture server is unavailable.');
    const browsers: Browser[] = [];
    const loader = new PlaywrightBrowserLoader({
      launchBrowser: async () => {
        const browser = await chromium.launch({ headless: true });
        browsers.push(browser);
        return browser;
      },
    });
    const loaded = await loader.load({
      url: `${fixtureServer.origin}/accessibility-semantics.html`,
    });
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;

    let nextId = 0;
    const collector = new BrowserAccessibilityEvidenceCollector(
      {
        assessmentId: 'assessment-accessibility',
        pageId: 'page-accessibility',
        rawEvidenceIds: ['browser-evidence', 'scanner-evidence'],
      },
      {
        clock: () => new Date('2026-09-28T13:00:00.000Z'),
        idFactory: () => `accessibility-evidence-${++nextId}`,
      },
    );

    try {
      const evidence = await collector.collect(loaded.capture, [
        target('email', '#email', 'scanner-evidence'),
        target('updates', '#updates'),
        target('toggle', '#toggle'),
        target('empty-action', '#empty-action'),
        target('hidden-action', '#hidden-action'),
        target('detached-action', '#detached-action'),
      ]);

      expectCollected(evidence, 'email', {
        role: { status: 'available', value: 'textbox' },
        name: { status: 'available', value: 'Email address' },
        description: { status: 'available', value: 'Used for service notices.' },
        value: { status: 'available', value: 'person@example.gov' },
        focusable: { status: 'available', value: true },
      });
      const email = collected(evidence, 'email');
      expect(email.payload.semantics.states.required).toEqual({
        status: 'available',
        value: true,
      });
      expect(email.payload.semantics.relationships.describedBy).toEqual({
        status: 'available',
        value: [{ idref: 'email-help', text: null }],
      });

      const updates = collected(evidence, 'updates');
      expect(updates.payload.semantics).toMatchObject({
        role: { status: 'available', value: 'checkbox' },
        name: { status: 'available', value: 'Receive updates' },
        description: { status: 'available', value: 'Sends a weekly digest.' },
        focusable: { status: 'available', value: true },
        states: { checked: { status: 'available', value: 'true' } },
      });
      expect(updates.payload.semantics.relationships.labelledBy).toEqual({
        status: 'available',
        value: [{ idref: 'updates-label', text: 'Receive updates' }],
      });

      const toggle = collected(evidence, 'toggle');
      expect(toggle.payload.semantics.states.expanded).toEqual({
        status: 'available',
        value: false,
      });
      expect(toggle.payload.semantics.relationships.controls).toEqual({
        status: 'available',
        value: [{ idref: 'details-panel', text: null }],
      });

      const missingName = collected(evidence, 'empty-action');
      expect(missingName.payload.semantics.name).toEqual({ status: 'available', value: '' });
      expect(missingName.payload.semantics.description).toEqual({
        status: 'unavailable',
        reason: 'not_exposed_or_not_applicable',
      });

      expect(errorEvidence(evidence, 'hidden-action').payload.error.code).toBe('hidden_target');
      expect(errorEvidence(evidence, 'detached-action').payload.error.code).toBe(
        'target_not_found_or_detached',
      );

      for (const item of evidence) {
        const roundTripped = accessibilitySemanticsEvidenceSchema.parse(
          JSON.parse(JSON.stringify(item)),
        );
        expect(roundTripped).toEqual(item);
        expect(item.source).toMatchObject({
          type: 'accessibility_api',
          name: 'Chrome DevTools Protocol Accessibility',
        });
        expect(item.payload.provenance).toMatchObject({
          classification: 'browser_accessibility_semantics',
          assistiveTechnologyOutput: false,
          browserName: 'chromium',
          automationName: 'playwright',
        });
        expect(JSON.stringify(item).toLowerCase()).not.toContain('nvda output');
        expect(item.metadata.rawEvidenceIds).toEqual(['browser-evidence', 'scanner-evidence']);
      }
    } finally {
      await loaded.capture.close();
    }

    expect(loaded.capture.closed).toBe(true);
    expect(browsers).toHaveLength(1);
    expect(browsers[0]?.isConnected()).toBe(false);
  });
});

function target(
  id: string,
  selector: string,
  sourceEvidenceId: string | null = null,
): AccessibilityTargetDescriptor {
  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id,
    strategy: 'css',
    selector,
    sourceEvidenceId,
  };
}

function collected(
  evidence: AccessibilitySemanticsEvidence[],
  targetId: string,
): CollectedEvidence {
  const item = evidence.find((candidate) => candidate.metadata.targetId === targetId);
  if (!item || item.payload.collectionStatus !== 'collected') {
    throw new Error(`Expected collected evidence for ${targetId}.`);
  }
  return item as CollectedEvidence;
}

function errorEvidence(
  evidence: AccessibilitySemanticsEvidence[],
  targetId: string,
): ErrorEvidence {
  const item = evidence.find((candidate) => candidate.metadata.targetId === targetId);
  if (!item || item.payload.collectionStatus !== 'error') {
    throw new Error(`Expected error evidence for ${targetId}.`);
  }
  return item as ErrorEvidence;
}

function expectCollected(
  evidence: AccessibilitySemanticsEvidence[],
  targetId: string,
  expected: Record<string, unknown>,
): void {
  expect(collected(evidence, targetId).payload.semantics).toMatchObject(expected);
}
