import type { FindingsExporter } from '@accessledger/export';
import { FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION } from '@accessledger/shared';
import { describe, expect, it, vi } from 'vitest';

import { runFindingsExportCli } from '../src/export-cli.js';

describe('Findings export CLI', () => {
  it('prints help without opening a database', () => {
    const output: string[] = [];
    const createSession = vi.fn();

    expect(
      runFindingsExportCli(['--help'], {
        createSession,
        stdout: (text) => output.push(text),
      }),
    ).toBe(0);
    expect(output.join('')).toContain('npm run findings:export');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('exports with explicit format/destination, prints the manifest, and closes resources', () => {
    const output: string[] = [];
    const close = vi.fn();
    const exporter: FindingsExporter = {
      export: vi.fn(() => ({
        schemaVersion: FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION,
        format: 'csv' as const,
        assessmentId: 'assessment-review',
        generatedAt: '2026-09-28T20:00:00.000Z',
        recordCount: 2,
        artifactPath: '/tmp/findings.csv',
        sha256: 'a'.repeat(64),
        byteLength: 500,
      })),
    };
    const createSession = vi.fn(() => ({ exporter, close }));

    const exitCode = runFindingsExportCli(
      ['review.sqlite', 'assessment-review', 'csv', 'output/findings.csv', '--overwrite'],
      {
        createSession,
        stdout: (text) => output.push(text),
      },
    );

    expect(exitCode).toBe(0);
    expect(createSession).toHaveBeenCalledWith('review.sqlite', true);
    expect(exporter.export).toHaveBeenCalledWith('assessment-review', 'csv', 'output/findings.csv');
    expect(JSON.parse(output.join(''))).toMatchObject({ recordCount: 2, format: 'csv' });
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([
    [],
    ['review.sqlite', 'assessment-review', 'xlsx', 'findings.xlsx'],
    ['review.sqlite', 'assessment-review', 'json'],
    ['review.sqlite', 'assessment-review', 'json', 'findings.json', '--replace'],
    ['review.sqlite', 'assessment-review', 'json', 'findings.json', '--overwrite', '--overwrite'],
  ])('rejects invalid arguments %j', (...args) => {
    const errors: string[] = [];
    const createSession = vi.fn();

    expect(
      runFindingsExportCli(args, {
        createSession,
        stderr: (text) => errors.push(text),
      }),
    ).toBe(1);
    expect(errors.join('')).toContain('Usage:');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('reports export refusal and still closes the repository session', () => {
    const errors: string[] = [];
    const close = vi.fn();
    const exporter: FindingsExporter = {
      export: () => {
        throw new Error('Approved Finding has a broken trace.');
      },
    };

    expect(
      runFindingsExportCli(['review.sqlite', 'assessment-review', 'json', 'findings.json'], {
        createSession: () => ({ exporter, close }),
        stderr: (text) => errors.push(text),
      }),
    ).toBe(1);
    expect(errors.join('')).toContain('broken trace');
    expect(close).toHaveBeenCalledOnce();
  });
});
