import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { DeterministicFindingsExporter, type FindingsExporter } from '@accessledger/export';
import { FindingReviewService } from '@accessledger/findings';
import { ResidentJourneyService } from '@accessledger/journeys';
import { SqliteReviewRepository } from '@accessledger/persistence';
import type { FindingsRegisterExportFormat } from '@accessledger/shared';

type WriteText = (text: string) => void;

interface ExporterSession {
  exporter: FindingsExporter;
  close(): void;
}

export interface FindingsExportCliDependencies {
  createSession?: (databasePath: string, overwrite: boolean) => ExporterSession;
  stdout?: WriteText;
  stderr?: WriteText;
}

const usage = `Usage: npm run findings:export -- <database-path> <assessment-id> <json|csv> <destination> [--overwrite]
Exports approved, fully supported Findings only. Existing destinations are refused unless --overwrite is supplied.
`;

export function runFindingsExportCli(
  args: readonly string[],
  dependencies: FindingsExportCliDependencies = {},
): number {
  const stdout = dependencies.stdout ?? ((text) => process.stdout.write(text));
  const stderr = dependencies.stderr ?? ((text) => process.stderr.write(text));
  if (args.length === 1 && ['--help', '-h'].includes(args[0] ?? '')) {
    stdout(usage);
    return 0;
  }
  const parsed = parseArguments(args);
  if (parsed === null) {
    stderr(usage);
    return 1;
  }

  let session: ExporterSession | undefined;
  try {
    session = (dependencies.createSession ?? createDefaultSession)(
      parsed.databasePath,
      parsed.overwrite,
    );
    const manifest = session.exporter.export(
      parsed.assessmentId,
      parsed.format,
      parsed.destination,
    );
    stdout(`${JSON.stringify(manifest, null, 2)}\n`);
    return 0;
  } catch (error) {
    stderr(`Findings export failed: ${errorMessage(error)}\n`);
    return 1;
  } finally {
    session?.close();
  }
}

function parseArguments(args: readonly string[]): {
  databasePath: string;
  assessmentId: string;
  format: FindingsRegisterExportFormat;
  destination: string;
  overwrite: boolean;
} | null {
  const [databasePath, assessmentId, format, destination, ...flags] = args;
  if (
    databasePath === undefined ||
    assessmentId === undefined ||
    destination === undefined ||
    (format !== 'json' && format !== 'csv') ||
    [databasePath, assessmentId, destination].some((value) => value.trim().length === 0) ||
    flags.some((flag) => flag !== '--overwrite') ||
    flags.length !== new Set(flags).size
  ) {
    return null;
  }
  return {
    databasePath,
    assessmentId,
    format,
    destination,
    overwrite: flags.includes('--overwrite'),
  };
}

function createDefaultSession(databasePathInput: string, overwrite: boolean): ExporterSession {
  const databasePath = resolve(databasePathInput);
  if (!existsSync(databasePath)) {
    throw new Error(`Review database does not exist: ${databasePath}`);
  }
  const repository = new SqliteReviewRepository(databasePath);
  return {
    exporter: new DeterministicFindingsExporter(
      new FindingReviewService(repository),
      new ResidentJourneyService(repository),
      { overwrite },
    ),
    close: () => repository.close(),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim() || error.name;
  return String(error) || 'Unknown error.';
}
