import { randomUUID } from 'node:crypto';

import { assessRawPage } from '@accessledger/evidence';
import {
  rawPageAssessmentRequestSchema,
  type RawPageAssessment,
  type RawPageAssessmentRequest,
} from '@accessledger/shared';

type AssessRawPage = (request: RawPageAssessmentRequest) => Promise<RawPageAssessment>;
type WriteText = (text: string) => void;

export type ScanCliDependencies = {
  assess?: AssessRawPage;
  createAssessmentId?: () => string;
  stdout?: WriteText;
  stderr?: WriteText;
};

export async function runScanCli(
  args: readonly string[],
  dependencies: ScanCliDependencies = {},
): Promise<number> {
  const stdout = dependencies.stdout ?? ((text) => process.stdout.write(text));
  const stderr = dependencies.stderr ?? ((text) => process.stderr.write(text));

  if (args.length !== 1) {
    stderr('Usage: npm run scan -- <URL>\n');
    return 1;
  }

  const request = rawPageAssessmentRequestSchema.safeParse({
    assessmentId: dependencies.createAssessmentId?.() ?? `developer-scan-${randomUUID()}`,
    url: args[0],
  });
  if (!request.success) {
    stderr(`Invalid URL: ${args[0]}\n`);
    return 1;
  }

  try {
    const result = await (dependencies.assess ?? assessRawPage)(request.data);
    stdout(`${JSON.stringify(result, null, 2)}\n`);
    return result.operationalResult.status === 'loaded' ? 0 : 1;
  } catch (error) {
    stderr(`Scan failed: ${errorMessage(error)}\n`);
    return 1;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim() || error.name;
  }
  return String(error) || 'Unknown error.';
}
