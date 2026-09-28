import { describe, expect, it } from 'vitest';

import {
  CONTRACT_SCHEMA_VERSION,
  groupProposalSchema,
  observationOccurrenceSchema,
  observationSchema,
  pageSchema,
  type Observation,
  type ObservationOccurrence,
  type Page,
} from '@accessledger/shared';

import { ConservativeGroupingEngine, GROUPING_ALGORITHM_VERSION } from '../src/index.js';

const now = '2026-09-28T16:00:00.000Z';

describe('ConservativeGroupingEngine', () => {
  it('consolidates 236 repeated component occurrences into one inspectable proposal without loss', () => {
    const observation = fixtureObservation({
      id: 'observation-repeat',
      evidenceIds: ['rule-evidence'],
    });
    const occurrences = Array.from({ length: 236 }, (_, index) =>
      fixtureOccurrence({
        id: `occurrence-${String(index + 1).padStart(3, '0')}`,
        observationId: observation.id,
        pageId: 'page-list',
        selector: `.directory > article:nth-child(${index + 1}) > button.contact`,
        componentFingerprint: ' Directory Contact Button ',
        evidenceIds: [`node-evidence-${index + 1}`],
      }),
    );
    const observations = [observation];
    const context = { pages: [fixturePage({ id: 'page-list' })] };
    const before = JSON.stringify({ observations, occurrences, context });

    const proposals = engine().propose(observations, occurrences, context);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      groupingAlgorithmVersion: GROUPING_ALGORITHM_VERSION,
      kind: 'repeat_candidate',
      reviewStatus: 'pending',
      groupingConfidence: 'high',
      memberObservationIds: ['observation-repeat'],
      pageIds: ['page-list'],
    });
    expect(proposals[0]?.members).toHaveLength(236);
    expect([...proposals[0]!.memberOccurrenceIds].sort()).toEqual(
      occurrences.map((occurrence) => occurrence.id).sort(),
    );
    expect(proposals[0]?.evidenceIds).toContain('rule-evidence');
    expect(proposals[0]?.evidenceIds).toContain('node-evidence-236');
    expect(proposals[0]?.signals).toContainEqual({
      type: 'component_fingerprint',
      strength: 'identity',
      value: 'directory contact button',
      occurrenceIds: proposals[0]!.memberOccurrenceIds,
    });
    expect(JSON.stringify({ observations, occurrences, context })).toBe(before);
  });

  it('keeps similar components with distinct fingerprints separate', () => {
    const observation = fixtureObservation({ id: 'observation-buttons' });
    const occurrences = [
      fixtureOccurrence({
        id: 'occurrence-primary',
        observationId: observation.id,
        selector: '.actions > button',
        componentFingerprint: 'primary-action',
      }),
      fixtureOccurrence({
        id: 'occurrence-secondary',
        observationId: observation.id,
        selector: '.actions > button',
        componentFingerprint: 'secondary-action',
      }),
    ];

    const proposals = engine().propose([observation], occurrences, {
      pages: [fixturePage()],
    });

    expect(proposals).toHaveLength(2);
    expect(proposals.map((proposal) => proposal.kind)).toEqual(['singleton', 'singleton']);
    expect(proposals.every((proposal) => proposal.members.length === 1)).toBe(true);
  });

  it('groups matching structures across pages only with explicit shared template context', () => {
    const observations = [
      fixtureObservation({ id: 'observation-departments', evidenceIds: ['scanner-departments'] }),
      fixtureObservation({ id: 'observation-services', evidenceIds: ['scanner-services'] }),
    ];
    const pages = [
      fixturePage({
        id: 'page-departments',
        requestedUrl: 'https://fixture.example/departments/public-works',
      }),
      fixturePage({
        id: 'page-services',
        requestedUrl: 'https://fixture.example/services/permits',
      }),
    ];
    const occurrences = [
      fixtureOccurrence({
        id: 'occurrence-departments',
        observationId: observations[0]!.id,
        pageId: pages[0]!.id,
        selector: 'main > .service-card:nth-child(1) > button',
        htmlSnippet: '<button class="service-action"></button>',
        evidenceIds: ['node-departments'],
      }),
      fixtureOccurrence({
        id: 'occurrence-services',
        observationId: observations[1]!.id,
        pageId: pages[1]!.id,
        selector: 'main > .service-card:nth-child(9) > button',
        htmlSnippet: '<button class="service-action"></button>',
        evidenceIds: ['node-services'],
      }),
    ];

    const proposals = engine().propose(observations, occurrences, {
      pages,
      pageTemplates: [
        { pageId: pages[0]!.id, templateId: 'service-detail-v1' },
        { pageId: pages[1]!.id, templateId: 'service-detail-v1' },
      ],
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      kind: 'repeat_candidate',
      groupingConfidence: 'medium',
      memberObservationIds: ['observation-departments', 'observation-services'],
      memberOccurrenceIds: ['occurrence-departments', 'occurrence-services'],
      pageIds: ['page-departments', 'page-services'],
    });
    expect(proposals[0]?.signals).toContainEqual({
      type: 'page_template',
      strength: 'context',
      value: 'service-detail-v1',
      occurrenceIds: ['occurrence-departments', 'occurrence-services'],
    });
  });

  it('uses a component fingerprint despite unstable selectors', () => {
    const observations = [
      fixtureObservation({ id: 'observation-first' }),
      fixtureObservation({ id: 'observation-second' }),
    ];
    const occurrences = [
      fixtureOccurrence({
        id: 'occurrence-first',
        observationId: 'observation-first',
        selector: '#generated-2918 > button:nth-child(1)',
        componentFingerprint: 'global-header/action',
      }),
      fixtureOccurrence({
        id: 'occurrence-second',
        observationId: 'observation-second',
        selector: '[data-runtime="b721"] > div > button:nth-child(7)',
        componentFingerprint: 'GLOBAL-HEADER/action',
      }),
    ];

    const proposals = engine().propose(observations, occurrences, {
      pages: [fixturePage()],
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ kind: 'repeat_candidate', groupingConfidence: 'high' });
    expect(proposals[0]?.signals.some((signal) => signal.type === 'selector_structure')).toBe(
      false,
    );
  });

  it('preserves weak cross-page matches as separate ambiguous proposals and unrelated input as a singleton', () => {
    const observations = [
      fixtureObservation({ id: 'observation-a' }),
      fixtureObservation({ id: 'observation-b' }),
      fixtureObservation({
        id: 'observation-c',
        sourceRuleId: 'label',
        category: 'programmatic_label',
      }),
    ];
    const pages = [
      fixturePage({ id: 'page-a', requestedUrl: 'https://fixture.example/a' }),
      fixturePage({ id: 'page-b', requestedUrl: 'https://fixture.example/b' }),
    ];
    const occurrences = [
      fixtureOccurrence({
        id: 'occurrence-a',
        observationId: 'observation-a',
        pageId: 'page-a',
        selector: 'main > .card > button',
      }),
      fixtureOccurrence({
        id: 'occurrence-b',
        observationId: 'observation-b',
        pageId: 'page-b',
        selector: 'main > .card > button',
      }),
      fixtureOccurrence({
        id: 'occurrence-c',
        observationId: 'observation-c',
        pageId: 'page-a',
        selector: '#email',
        htmlSnippet: '<input id="email" type="email">',
      }),
    ];

    const proposals = engine().propose(observations, occurrences, { pages });

    expect(proposals.map((proposal) => proposal.kind)).toEqual([
      'ambiguous',
      'ambiguous',
      'singleton',
    ]);
    expect(proposals[0]?.ambiguity).toEqual({
      reason: 'missing_shared_page_template',
      relatedOccurrenceIds: ['occurrence-b'],
    });
    expect(proposals[1]?.ambiguity).toEqual({
      reason: 'missing_shared_page_template',
      relatedOccurrenceIds: ['occurrence-a'],
    });
    expect(proposals[2]?.ambiguity).toBeNull();
  });

  it('retains every traceability ID exactly once across mixed proposal outcomes', () => {
    const observations = [
      fixtureObservation({ id: 'observation-1', evidenceIds: ['observation-evidence-1'] }),
      fixtureObservation({ id: 'observation-2', evidenceIds: ['observation-evidence-2'] }),
      fixtureObservation({ id: 'observation-3', evidenceIds: ['observation-evidence-3'] }),
    ];
    const occurrences = [
      fixtureOccurrence({
        id: 'occurrence-1',
        observationId: 'observation-1',
        componentFingerprint: 'shared-card',
        evidenceIds: ['occurrence-evidence-1'],
      }),
      fixtureOccurrence({
        id: 'occurrence-2',
        observationId: 'observation-2',
        componentFingerprint: 'shared-card',
        evidenceIds: ['occurrence-evidence-2'],
      }),
      fixtureOccurrence({
        id: 'occurrence-3',
        observationId: 'observation-3',
        selector: '#unique',
        evidenceIds: ['occurrence-evidence-3'],
      }),
    ];

    const proposals = engine().propose(observations, occurrences, {
      pages: [fixturePage()],
    });
    const members = proposals.flatMap((proposal) => proposal.members);

    expect(members.map((member) => member.occurrenceId).sort()).toEqual(
      occurrences.map((occurrence) => occurrence.id).sort(),
    );
    expect(new Set(members.map((member) => member.occurrenceId)).size).toBe(occurrences.length);
    expect(members.find((member) => member.occurrenceId === 'occurrence-1')).toEqual({
      observationId: 'observation-1',
      occurrenceId: 'occurrence-1',
      pageId: 'page-fixture',
      evidenceIds: ['observation-evidence-1', 'occurrence-evidence-1'],
    });
    expect(proposals.flatMap((proposal) => proposal.evidenceIds).sort()).toEqual([
      'observation-evidence-1',
      'observation-evidence-2',
      'observation-evidence-3',
      'occurrence-evidence-1',
      'occurrence-evidence-2',
      'occurrence-evidence-3',
    ]);
  });

  it('is deterministic across input order and survives versioned JSON serialization', () => {
    const observations = [
      fixtureObservation({ id: 'observation-z' }),
      fixtureObservation({ id: 'observation-a' }),
    ];
    const occurrences = [
      fixtureOccurrence({
        id: 'occurrence-z',
        observationId: 'observation-z',
        componentFingerprint: 'footer-control',
      }),
      fixtureOccurrence({
        id: 'occurrence-a',
        observationId: 'observation-a',
        componentFingerprint: 'footer-control',
      }),
    ];
    const context = { pages: [fixturePage()] };

    const first = engine().propose(observations, occurrences, context);
    const second = engine().propose(
      [...observations].reverse(),
      [...occurrences].reverse(),
      context,
    );
    const serialized = JSON.stringify(first);
    const roundTrip = JSON.parse(serialized) as unknown;

    expect(second).toEqual(first);
    expect(first[0]?.id).toMatch(/^group-proposal-[a-f0-9]{24}$/);
    expect(groupProposalSchema.array().parse(roundTrip)).toEqual(first);
    expect(groupProposalSchema.safeParse({ ...first[0], schemaVersion: '2.0.0' }).success).toBe(
      false,
    );
  });

  it.each(['rejected', 'split'] as const)(
    'preserves all members and traceability when review status becomes %s',
    (reviewStatus) => {
      const observation = fixtureObservation({ id: 'observation-review' });
      const occurrences = [
        fixtureOccurrence({
          id: 'occurrence-review-1',
          observationId: observation.id,
          componentFingerprint: 'review-component',
        }),
        fixtureOccurrence({
          id: 'occurrence-review-2',
          observationId: observation.id,
          componentFingerprint: 'review-component',
        }),
      ];
      const proposal = engine().propose([observation], occurrences, {
        pages: [fixturePage()],
      })[0]!;

      const reviewed = groupProposalSchema.parse({ ...proposal, reviewStatus, updatedAt: now });

      expect(reviewed.members).toEqual(proposal.members);
      expect(reviewed.memberOccurrenceIds).toEqual(proposal.memberOccurrenceIds);
      expect(reviewed.evidenceIds).toEqual(proposal.evidenceIds);
    },
  );

  it('rejects incomplete or cross-assessment traceability instead of dropping input', () => {
    const observation = fixtureObservation({ id: 'observation-orphan' });
    expect(() => engine().propose([observation], [], { pages: [fixturePage()] })).toThrow(
      /cannot silently drop/,
    );

    const occurrence = fixtureOccurrence({
      id: 'occurrence-missing-page',
      observationId: observation.id,
      pageId: 'missing-page',
    });
    expect(() => engine().propose([observation], [occurrence], { pages: [fixturePage()] })).toThrow(
      /missing Page/,
    );
  });
});

function engine(): ConservativeGroupingEngine {
  return new ConservativeGroupingEngine({ clock: () => new Date(now) });
}

function fixtureObservation(
  overrides: Partial<Observation> & Pick<Observation, 'id'>,
): Observation {
  const { id, ...rest } = overrides;
  return observationSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id,
    assessmentId: 'assessment-fixture',
    source: { type: 'scanner', name: 'axe-core', version: '4.13.0' },
    sourceRuleId: 'button-name',
    category: 'accessible_name',
    summary: 'A button does not have a discernible accessible name.',
    testability: 'deterministic',
    evaluation: 'supported',
    candidateWcagCriteria: ['4.1.2'],
    evidenceIds: ['scanner-evidence'],
    facts: { result: 'violation' },
    createdAt: now,
    updatedAt: now,
    ...rest,
  });
}

function fixtureOccurrence(
  overrides: Partial<ObservationOccurrence> & Pick<ObservationOccurrence, 'id' | 'observationId'>,
): ObservationOccurrence {
  const { id, observationId, ...rest } = overrides;
  return observationOccurrenceSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id,
    assessmentId: 'assessment-fixture',
    observationId,
    pageId: 'page-fixture',
    evidenceIds: ['scanner-evidence'],
    selector: '#save',
    htmlSnippet: '<button class="action"></button>',
    componentFingerprint: null,
    sourceDetail: { kind: 'axe_node' },
    observedAt: now,
    ...rest,
  });
}

function fixturePage(overrides: Partial<Page> = {}): Page {
  const requestedUrl = overrides.requestedUrl ?? 'https://fixture.example/page';
  return pageSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'page-fixture',
    assessmentId: 'assessment-fixture',
    requestedUrl,
    finalUrl: requestedUrl,
    title: 'Fixture',
    language: 'en',
    loadStatus: 'loaded',
    loadedAt: now,
    failureReason: null,
    rawEvidenceIds: ['scanner-evidence'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}
