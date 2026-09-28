import { describe, expect, it, vi } from 'vitest';

import { CONTRACT_SCHEMA_VERSION, type RawPageAssessment } from '@accessledger/shared';

import { runScanCli } from '../src/scan-cli.js';

describe('scan CLI', () => {
  it('scans exactly one URL and prints serializable JSON', async () => {
    const output: string[] = [];
    const result = makeResult('loaded');
    const assess = vi.fn(async () => result);

    const exitCode = await runScanCli(['https://example.gov/'], {
      assess,
      createAssessmentId: () => 'assessment-cli',
      stdout: (text) => output.push(text),
    });

    expect(exitCode).toBe(0);
    expect(assess).toHaveBeenCalledWith({
      assessmentId: 'assessment-cli',
      url: 'https://example.gov/',
    });
    expect(JSON.parse(output.join(''))).toEqual(result);
  });

  it('forwards repeated CSS targets through the existing assessment request', async () => {
    const result = makeResult('loaded');
    const assess = vi.fn(async () => result);

    const exitCode = await runScanCli(
      [
        'https://example.gov/',
        '--target',
        '.site-search-button',
        '--target',
        '#label_1',
        '--target',
        '.slick-prev',
      ],
      {
        assess,
        createAssessmentId: () => 'assessment-cli',
        stdout: () => undefined,
      },
    );

    expect(exitCode).toBe(0);
    expect(assess).toHaveBeenCalledWith({
      assessmentId: 'assessment-cli',
      url: 'https://example.gov/',
      accessibilityTargets: [
        {
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          id: 'cli-target-1',
          strategy: 'css',
          selector: '.site-search-button',
          sourceEvidenceId: null,
        },
        {
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          id: 'cli-target-2',
          strategy: 'css',
          selector: '#label_1',
          sourceEvidenceId: null,
        },
        {
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          id: 'cli-target-3',
          strategy: 'css',
          selector: '.slick-prev',
          sourceEvidenceId: null,
        },
      ],
    });
  });

  it.each([
    [],
    ['https://example.gov/', 'https://example.gov/other'],
    ['https://example.gov/', '--target'],
    ['https://example.gov/', '--target', '  '],
    ['https://example.gov/', '--unknown', '#main'],
    ['not-a-url'],
  ])('rejects invalid arguments %j without scanning', async (...args) => {
    const errors: string[] = [];
    const assess = vi.fn();

    const exitCode = await runScanCli(args, {
      assess,
      stderr: (text) => errors.push(text),
    });

    expect(exitCode).toBe(1);
    expect(assess).not.toHaveBeenCalled();
    expect(errors.join('')).not.toHaveLength(0);
  });

  it('prints operational failure JSON and returns a non-zero exit code', async () => {
    const output: string[] = [];
    const result = makeResult('navigation_failed');

    const exitCode = await runScanCli(['https://example.gov/'], {
      assess: async () => result,
      stdout: (text) => output.push(text),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(output.join(''))).toEqual(result);
  });
});

function makeResult(status: 'loaded' | 'navigation_failed'): RawPageAssessment {
  const timestamp = '2026-09-28T12:00:00.000Z';
  const failed = status === 'navigation_failed';
  const scannerEvidence = failed
    ? null
    : {
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: 'scanner-evidence-1',
        assessmentId: 'assessment-cli',
        pageId: 'page-1',
        kind: 'raw_scanner_result' as const,
        source: { type: 'scanner' as const, name: 'axe-core', version: '4.13.0' },
        capturedAt: timestamp,
        contentType: 'application/json',
        payload: { violations: [] },
        metadata: {},
      };

  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    page: {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'page-1',
      assessmentId: 'assessment-cli',
      requestedUrl: 'https://example.gov/',
      finalUrl: failed ? null : 'https://example.gov/',
      title: failed ? null : 'Example',
      language: failed ? null : 'en',
      loadStatus: failed ? 'failed' : 'loaded',
      loadedAt: failed ? null : timestamp,
      failureReason: failed ? 'Navigation failed.' : null,
      rawEvidenceIds: failed
        ? ['browser-evidence-1']
        : ['browser-evidence-1', 'scanner-evidence-1'],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    browserEvidence: {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'browser-evidence-1',
      assessmentId: 'assessment-cli',
      pageId: 'page-1',
      kind: 'raw_browser_result',
      source: { type: 'browser', name: 'playwright', version: '1.63.0' },
      capturedAt: timestamp,
      contentType: 'application/json',
      payload: failed ? { status: 'failed' } : { status: 'loaded' },
      metadata: {},
    },
    scannerEvidence,
    accessibilityEvidence: [],
    operationalResult: failed
      ? {
          status: 'navigation_failed',
          error: { stage: 'navigation', name: 'Error', message: 'Navigation failed.' },
        }
      : { status: 'loaded' },
    startedAt: timestamp,
    completedAt: timestamp,
  };
}
