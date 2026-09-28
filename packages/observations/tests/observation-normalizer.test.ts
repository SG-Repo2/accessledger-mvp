import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assessRawPage } from '@accessledger/evidence';

import {
  CONTRACT_SCHEMA_VERSION,
  accessibilitySemanticsEvidenceSchema,
  evidenceSchema,
  pageSchema,
  type AccessibilitySemantics,
  type Evidence,
  type JsonValue,
} from '@accessledger/shared';

import { DeterministicObservationNormalizer } from '../src/index.js';
import {
  startFixtureServer,
  type FixtureServer,
} from '../../browser/tests/support/fixture-server.js';

const now = '2026-09-28T14:00:00.000Z';

describe('DeterministicObservationNormalizer', () => {
  let fixtureServer: FixtureServer | undefined;

  beforeAll(async () => {
    fixtureServer = await startFixtureServer();
  });

  afterAll(async () => {
    if (fixtureServer) await fixtureServer.close();
  });

  it('normalizes validated scanner and semantics evidence from the controlled fixture', async () => {
    if (!fixtureServer) throw new Error('Fixture server is unavailable.');
    let nextId = 0;
    const assessment = await assessRawPage(
      {
        assessmentId: 'assessment-live-fixture',
        url: `${fixtureServer.origin}/accessibility-semantics.html`,
        accessibilityTargets: [
          {
            schemaVersion: CONTRACT_SCHEMA_VERSION,
            id: 'empty-button-target',
            strategy: 'css',
            selector: '#empty-action',
            sourceEvidenceId: null,
          },
        ],
      },
      { idFactory: (recordType) => `${recordType}-${++nextId}` },
    );
    const result = normalizer().normalize({
      page: assessment.page,
      evidence: [
        assessment.browserEvidence,
        ...(assessment.scannerEvidence ? [assessment.scannerEvidence] : []),
        ...assessment.accessibilityEvidence,
      ],
    });

    expect(result.observations.map((observation) => observation.sourceRuleId)).toEqual([
      'button-name',
      'empty-accessible-name',
    ]);
    expect(result.occurrences).toHaveLength(2);
    expect(result.occurrences.every((occurrence) => occurrence.pageId === assessment.page.id)).toBe(
      true,
    );
    expect(result.occurrences[0]?.selector).toBe('#empty-action');
    expect(result.occurrences[1]?.evidenceIds).toEqual([
      assessment.browserEvidence.id,
      assessment.scannerEvidence?.id,
      assessment.accessibilityEvidence[0]?.id,
    ]);
  });

  it('normalizes only covered axe violations and retains every concrete node', () => {
    const buttonNode = {
      impact: 'critical',
      target: [['#shell'], ['button[data-action="save"]']],
      html: '<button data-action="save"></button>',
      failureSummary: 'Fix the accessible name.',
      any: [{ id: 'button-has-visible-text', data: null, message: 'No text.' }],
      all: [],
      none: [],
    } satisfies JsonValue;
    const evidence = scannerEvidence({
      testEngine: { name: 'axe-core', version: '4.13.0' },
      violations: [
        {
          id: 'button-name',
          impact: 'critical',
          tags: ['cat.name-role-value', 'wcag2a', 'wcag412'],
          help: 'Buttons must have discernible text',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/button-name',
          nodes: [
            buttonNode,
            {
              impact: 'critical',
              target: ['#second-empty-button'],
              html: '<button id="second-empty-button"></button>',
              failureSummary: 'Fix the accessible name.',
              any: [],
              all: [],
              none: [],
            },
          ],
        },
        {
          id: 'unknown-fixture-rule',
          tags: ['wcag412'],
          nodes: [{ target: ['#unknown'], html: '<div id="unknown"></div>' }],
        },
      ],
      passes: [],
      incomplete: [],
      inapplicable: [],
    });

    const result = normalizer().normalize({ page: fixturePage(), evidence: [evidence] });

    expect(result.observations).toHaveLength(1);
    expect(result.occurrences).toHaveLength(2);
    expect(result.observations[0]).toMatchObject({
      source: { type: 'scanner', name: 'axe-core', version: '4.13.0' },
      sourceRuleId: 'button-name',
      category: 'accessible_name',
      evaluation: 'supported',
      candidateWcagCriteria: ['4.1.2'],
      evidenceIds: ['scanner-evidence'],
      facts: { result: 'violation', occurrenceCount: 2 },
    });
    expect(result.occurrences.map((occurrence) => occurrence.selector)).toEqual([
      '#shell >>> button[data-action="save"]',
      '#second-empty-button',
    ]);
    expect(result.occurrences[0]).toMatchObject({
      pageId: 'page-fixture',
      evidenceIds: ['scanner-evidence'],
      htmlSnippet: '<button data-action="save"></button>',
      observedAt: now,
    });
    expect((result.occurrences[0]?.sourceDetail as Record<string, JsonValue>).node).toEqual(
      buttonNode,
    );
    expect(result.unrecognizedRules).toEqual([
      {
        evidenceId: 'scanner-evidence',
        tool: 'axe-core',
        toolVersion: '4.13.0',
        ruleId: 'unknown-fixture-rule',
      },
    ]);
  });

  it('does not convert passes, unknown rules, or browser evidence into observations', () => {
    const scanner = scannerEvidence({
      violations: [
        {
          id: 'unknown-fixture-rule',
          nodes: [{ target: ['#unknown'], html: '<div id="unknown"></div>' }],
        },
      ],
      passes: [{ id: 'button-name', nodes: [{ target: ['#named'] }] }],
      incomplete: [],
      inapplicable: [],
    });
    const browser = evidenceSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'browser-evidence',
      assessmentId: 'assessment-fixture',
      pageId: 'page-fixture',
      kind: 'raw_browser_result',
      source: { type: 'browser', name: 'playwright', version: '1.63.0' },
      capturedAt: now,
      contentType: 'application/json',
      payload: { status: 'loaded' },
      metadata: {},
    });

    const result = normalizer().normalize({
      page: fixturePage(),
      evidence: [browser, scanner],
    });

    expect(result.observations).toEqual([]);
    expect(result.occurrences).toEqual([]);
    expect(result.ignoredEvidence).toEqual([
      { evidenceId: 'browser-evidence', reason: 'not_a_supported_source' },
      { evidenceId: 'scanner-evidence', reason: 'no_covered_deterministic_fact' },
    ]);
    expect(result.unrecognizedRules).toEqual([
      {
        evidenceId: 'scanner-evidence',
        tool: 'axe-core',
        toolVersion: '4.13.0',
        ruleId: 'unknown-fixture-rule',
      },
    ]);
  });

  it('normalizes an explicit empty computed button name without treating browser semantics as AT output', () => {
    const semantics = accessibilityEvidence('');
    const result = normalizer().normalize({
      page: fixturePage(),
      evidence: [semantics],
    });

    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({
      sourceRuleId: 'empty-accessible-name',
      evidenceIds: ['browser-evidence', 'scanner-evidence', 'semantics-evidence'],
      facts: {
        collectionStatus: 'collected',
        role: 'button',
        name: '',
        targetId: 'empty-button-target',
        assistiveTechnologyOutput: false,
      },
    });
    expect(result.occurrences[0]).toMatchObject({
      pageId: 'page-fixture',
      selector: '#empty-action',
      evidenceIds: ['browser-evidence', 'scanner-evidence', 'semantics-evidence'],
    });
    const detail = result.occurrences[0]?.sourceDetail as Record<string, JsonValue>;
    expect(detail.target).toEqual(semantics.payload.target);
    expect(detail.semantics).toEqual(semantics.payload.semantics);
    expect(detail.provenance).toMatchObject({ assistiveTechnologyOutput: false });
  });

  it('does not infer an issue from a non-empty name or a semantics collection error', () => {
    const named = accessibilityEvidence('Submit request');
    const errored = accessibilitySemanticsEvidenceSchema.parse({
      ...accessibilityEvidence(''),
      id: 'semantics-error',
      payload: {
        ...accessibilityEvidence('').payload,
        collectionStatus: 'error',
        semantics: null,
        error: { code: 'hidden_target', message: 'Target is not rendered.' },
      },
    });

    const result = normalizer().normalize({
      page: fixturePage(),
      evidence: [named, errored],
    });

    expect(result.observations).toEqual([]);
    expect(result.ignoredEvidence).toEqual([
      { evidenceId: 'semantics-evidence', reason: 'no_covered_deterministic_fact' },
      { evidenceId: 'semantics-error', reason: 'collection_error' },
    ]);
  });

  it.each([
    ['label', 'programmatic_label'],
    ['aria-valid-attr-value', 'aria_validity'],
  ] as const)('normalizes the covered %s fixture rule', (ruleId, category) => {
    const evidence = scannerEvidence({
      violations: [
        {
          id: ruleId,
          tags: ['wcag412'],
          nodes: [{ target: ['#fixture-node'], html: '<div id="fixture-node"></div>' }],
        },
      ],
      passes: [],
      incomplete: [],
      inapplicable: [],
    });

    const result = normalizer().normalize({ page: fixturePage(), evidence: [evidence] });

    expect(result.observations[0]).toMatchObject({ sourceRuleId: ruleId, category });
    expect(result.occurrences).toHaveLength(1);
    expect(result.unrecognizedRules).toEqual([]);
  });

  it('is deterministic with injected IDs and time and rejects cross-page evidence', () => {
    const evidence = scannerEvidence({
      violations: [
        {
          id: 'label',
          tags: ['wcag412'],
          nodes: [{ target: ['#email'], html: '<input id="email">' }],
        },
      ],
      passes: [],
      incomplete: [],
      inapplicable: [],
    });
    const first = normalizer().normalize({ page: fixturePage(), evidence: [evidence] });
    const second = normalizer().normalize({ page: fixturePage(), evidence: [evidence] });
    expect(second).toEqual(first);

    expect(() =>
      normalizer().normalize({
        page: fixturePage(),
        evidence: [{ ...evidence, pageId: 'different-page' }],
      }),
    ).toThrow(/does not belong/);
  });
});

function normalizer(): DeterministicObservationNormalizer {
  return new DeterministicObservationNormalizer({
    clock: () => new Date(now),
    idFactory: (recordType, context) =>
      `${recordType}-${context.evidenceId}-${context.sourceRuleId}-${context.index}`,
  });
}

function fixturePage() {
  return pageSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'page-fixture',
    assessmentId: 'assessment-fixture',
    requestedUrl: 'https://fixture.example/page',
    finalUrl: 'https://fixture.example/page',
    title: 'Fixture',
    language: 'en',
    loadStatus: 'loaded',
    loadedAt: now,
    failureReason: null,
    rawEvidenceIds: [
      'browser-evidence',
      'scanner-evidence',
      'semantics-evidence',
      'semantics-error',
    ],
    createdAt: now,
    updatedAt: now,
  });
}

function scannerEvidence(payload: JsonValue): Evidence {
  return evidenceSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'scanner-evidence',
    assessmentId: 'assessment-fixture',
    pageId: 'page-fixture',
    kind: 'raw_scanner_result',
    source: { type: 'scanner', name: 'axe-core', version: '4.13.0' },
    capturedAt: now,
    contentType: 'application/json',
    payload,
    metadata: {},
  });
}

function accessibilityEvidence(name: string) {
  return accessibilitySemanticsEvidenceSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'semantics-evidence',
    assessmentId: 'assessment-fixture',
    pageId: 'page-fixture',
    kind: 'accessibility_semantics',
    source: {
      type: 'accessibility_api',
      name: 'Chrome DevTools Protocol Accessibility',
      version: '1.3',
    },
    capturedAt: now,
    contentType: 'application/json',
    payload: {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      collectionStatus: 'collected',
      target: {
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: 'empty-button-target',
        strategy: 'css',
        selector: '#empty-action',
        sourceEvidenceId: 'scanner-evidence',
      },
      provenance: {
        classification: 'browser_accessibility_semantics',
        apiName: 'Chrome DevTools Protocol Accessibility',
        apiVersion: '1.3',
        browserName: 'chromium',
        browserVersion: '153.0.8010.12',
        automationName: 'playwright',
        automationVersion: '1.63.0',
        assistiveTechnologyOutput: false,
      },
      semantics: semanticsPayload(name),
      error: null,
    },
    metadata: {
      targetId: 'empty-button-target',
      rawEvidenceIds: ['browser-evidence', 'scanner-evidence'],
      sourceEvidenceId: 'scanner-evidence',
    },
  });
}

function semanticsPayload(name: string): AccessibilitySemantics {
  const unavailable = {
    status: 'unavailable' as const,
    reason: 'not_exposed_or_not_applicable' as const,
  };
  return {
    role: { status: 'available', value: 'button' },
    name: { status: 'available', value: name },
    description: unavailable,
    value: unavailable,
    focusable: { status: 'available', value: true },
    states: {
      busy: unavailable,
      disabled: unavailable,
      focused: unavailable,
      invalid: unavailable,
      readOnly: unavailable,
      required: unavailable,
      checked: unavailable,
      expanded: unavailable,
      modal: unavailable,
      pressed: unavailable,
      selected: unavailable,
    },
    relationships: {
      activeDescendant: unavailable,
      controls: unavailable,
      describedBy: unavailable,
      details: unavailable,
      errorMessage: unavailable,
      flowTo: unavailable,
      labelledBy: unavailable,
      owns: unavailable,
    },
  };
}
