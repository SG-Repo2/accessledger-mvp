import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { SqliteReviewRepository } from '@accessledger/persistence';
import { rawPageAssessmentSchema, type RawPageAssessment } from '@accessledger/shared';

import {
  createAssessmentPreparationStages,
  prepareAssessmentForReview,
  type AssessmentPreparationCounts,
} from './prepare-assessment.js';

type WriteText = (text: string) => void;

interface PreparationSession {
  prepare(assessment: RawPageAssessment): AssessmentPreparationCounts;
  close(): void;
}

export interface AssessmentPrepareCliDependencies {
  createSession?: (databasePath: string, assessment: RawPageAssessment) => PreparationSession;
  stdout?: WriteText;
  stderr?: WriteText;
}

const usage = `Usage: npm run assessment:prepare -- <scan-json-path> <database-path>
Prepares eligible draft Findings and their complete source traces for Auditor Studio review.
`;

export function runAssessmentPrepareCli(
  args: readonly string[],
  dependencies: AssessmentPrepareCliDependencies = {},
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

  let session: PreparationSession | undefined;
  try {
    const assessment = readAssessment(parsed.inputPath);
    if (assessment.operationalResult.status !== 'loaded') {
      throw new Error(
        `Assessment preparation refused operational status ${assessment.operationalResult.status}.`,
      );
    }
    session = (dependencies.createSession ?? createDefaultSession)(parsed.databasePath, assessment);
    const counts = session.prepare(assessment);
    stdout(
      `${JSON.stringify(
        {
          assessmentId: assessment.page.assessmentId,
          inputPath: parsed.inputPath,
          databasePath: parsed.databasePath,
          ...counts,
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  } catch (error) {
    stderr(`Assessment preparation failed: ${errorMessage(error)}\n`);
    return 1;
  } finally {
    session?.close();
  }
}

function parseArguments(
  args: readonly string[],
): { inputPath: string; databasePath: string } | null {
  if (args.length !== 2) return null;
  const [inputPath, databasePath] = args;
  if (
    inputPath === undefined ||
    databasePath === undefined ||
    inputPath.trim().length === 0 ||
    databasePath.trim().length === 0
  ) {
    return null;
  }
  return { inputPath: resolve(inputPath), databasePath: resolve(databasePath) };
}

function readAssessment(inputPath: string): RawPageAssessment {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(inputPath, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`Could not read valid JSON from ${inputPath}: ${errorMessage(error)}`, {
      cause: error,
    });
  }
  const parsed = rawPageAssessmentSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`RawPageAssessment contract validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}

function createDefaultSession(
  databasePath: string,
  assessment: RawPageAssessment,
): PreparationSession {
  mkdirSync(dirname(databasePath), { recursive: true });
  const repository = new SqliteReviewRepository(databasePath);
  try {
    const stages = createAssessmentPreparationStages(assessment, repository);
    return {
      prepare: (input) => prepareAssessmentForReview(input, stages),
      close: () => repository.close(),
    };
  } catch (error) {
    repository.close();
    throw error;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim() || error.name;
  return String(error) || 'Unknown error.';
}
