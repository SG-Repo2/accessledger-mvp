import { randomUUID } from 'node:crypto';

import { assessRawPage } from '@accessledger/evidence';
import {
  CONTRACT_SCHEMA_VERSION,
  rawPageAssessmentRequestSchema,
  type AccessibilityTargetDescriptor,
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

  const parsedArguments = parseArguments(args);
  if (parsedArguments === null) {
    stderr('Usage: npm run scan -- <URL> [--target "<selector>" ...]\n');
    return 1;
  }

  const request = rawPageAssessmentRequestSchema.safeParse({
    assessmentId: dependencies.createAssessmentId?.() ?? `developer-scan-${randomUUID()}`,
    url: parsedArguments.url,
    ...(parsedArguments.targets.length === 0
      ? {}
      : { accessibilityTargets: parsedArguments.targets }),
  });
  if (!request.success) {
    stderr(`Invalid scan arguments for URL: ${parsedArguments.url}\n`);
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

function parseArguments(
  args: readonly string[],
): { url: string; targets: AccessibilityTargetDescriptor[] } | null {
  const url = args[0];
  if (url === undefined) return null;

  const targets: AccessibilityTargetDescriptor[] = [];
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    const selector = args[index + 1];
    if (flag !== '--target' || selector === undefined || selector.trim().length === 0) {
      return null;
    }
    targets.push({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: `cli-target-${targets.length + 1}`,
      strategy: 'css',
      selector,
      sourceEvidenceId: null,
    });
  }

  return { url, targets };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim() || error.name;
  }
  return String(error) || 'Unknown error.';
}
