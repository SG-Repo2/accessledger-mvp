import { randomUUID } from 'node:crypto';

import { PlaywrightBrowserLoader, type BrowserLoader } from '@accessledger/browser';
import { AxeCoreScanner, type AccessibilityScanner } from '@accessledger/scanner';
import {
  CONTRACT_SCHEMA_VERSION,
  rawPageAssessmentRequestSchema,
  rawPageAssessmentSchema,
  type Evidence,
  type Page,
  type RawPageAssessment,
  type RawPageAssessmentRequest,
} from '@accessledger/shared';

type Clock = () => Date;
type IdFactory = (recordType: 'page' | 'browser-evidence' | 'scanner-evidence') => string;

export type RawPageAssessorOptions = {
  browserLoader?: BrowserLoader;
  scanner?: AccessibilityScanner;
  clock?: Clock;
  idFactory?: IdFactory;
  navigationTimeoutMs?: number;
};

export class RawPageAssessor {
  readonly #browserLoader: BrowserLoader;
  readonly #scanner: AccessibilityScanner;
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;
  readonly #navigationTimeoutMs: number | undefined;

  constructor(options: RawPageAssessorOptions = {}) {
    this.#browserLoader = options.browserLoader ?? new PlaywrightBrowserLoader();
    this.#scanner = options.scanner ?? new AxeCoreScanner();
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? ((recordType) => `${recordType}-${randomUUID()}`);
    this.#navigationTimeoutMs = options.navigationTimeoutMs;
  }

  async assess(request: RawPageAssessmentRequest): Promise<RawPageAssessment> {
    const input = rawPageAssessmentRequestSchema.parse(request);
    const startedAt = this.#clock().toISOString();
    const loaded = await this.#browserLoader.load({
      url: input.url,
      ...(this.#navigationTimeoutMs === undefined ? {} : { timeoutMs: this.#navigationTimeoutMs }),
    });
    const pageId = this.#idFactory('page');
    const browserEvidenceId = this.#idFactory('browser-evidence');

    if (loaded.status === 'failed') {
      const completedAt = this.#clock().toISOString();
      const browserEvidence = makeBrowserFailureEvidence({
        id: browserEvidenceId,
        assessmentId: input.assessmentId,
        pageId,
        completedAt,
        failure: loaded,
      });
      const page: Page = {
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: pageId,
        assessmentId: input.assessmentId,
        requestedUrl: input.url,
        finalUrl: null,
        title: null,
        language: null,
        loadStatus: 'failed',
        loadedAt: null,
        failureReason: loaded.error.message,
        rawEvidenceIds: [browserEvidence.id],
        createdAt: startedAt,
        updatedAt: completedAt,
      };

      return rawPageAssessmentSchema.parse({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        page,
        browserEvidence,
        scannerEvidence: null,
        operationalResult: {
          status: 'navigation_failed',
          error: loaded.error,
        },
        startedAt,
        completedAt,
      });
    }

    const { capture } = loaded;
    try {
      const scannerCapture = await this.#scanner.scan(capture);
      const completedAt = this.#clock().toISOString();
      const scannerEvidenceId = this.#idFactory('scanner-evidence');
      const browserEvidence: Evidence = {
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: browserEvidenceId,
        assessmentId: input.assessmentId,
        pageId,
        kind: 'raw_browser_result',
        source: {
          type: 'browser',
          name: capture.data.automationName,
          version: capture.data.automationVersion,
        },
        capturedAt: capture.data.loadedAt,
        contentType: 'application/json',
        payload: { status: 'loaded', ...capture.data },
        metadata: {
          browserName: capture.data.browserName,
          browserVersion: capture.data.browserVersion,
        },
      };
      const scannerEvidence: Evidence = {
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: scannerEvidenceId,
        assessmentId: input.assessmentId,
        pageId,
        kind: 'raw_scanner_result',
        source: {
          type: 'scanner',
          name: scannerCapture.scannerName,
          version: scannerCapture.scannerVersion,
        },
        capturedAt: scannerCapture.capturedAt,
        contentType: 'application/json',
        payload:
          scannerCapture.status === 'completed'
            ? scannerCapture.rawResult
            : { status: 'failed', error: scannerCapture.error },
        metadata: { captureStatus: scannerCapture.status },
      };
      const page: Page = {
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: pageId,
        assessmentId: input.assessmentId,
        requestedUrl: input.url,
        finalUrl: capture.data.finalUrl,
        title: capture.data.title,
        language: capture.data.language,
        loadStatus: 'loaded',
        loadedAt: capture.data.loadedAt,
        failureReason: null,
        rawEvidenceIds: [browserEvidence.id, scannerEvidence.id],
        createdAt: startedAt,
        updatedAt: completedAt,
      };

      return rawPageAssessmentSchema.parse({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        page,
        browserEvidence,
        scannerEvidence,
        operationalResult:
          scannerCapture.status === 'completed'
            ? { status: 'loaded' }
            : { status: 'scan_failed', error: scannerCapture.error },
        startedAt,
        completedAt,
      });
    } finally {
      await capture.close();
    }
  }
}

export async function assessRawPage(
  request: RawPageAssessmentRequest,
  options: RawPageAssessorOptions = {},
): Promise<RawPageAssessment> {
  return new RawPageAssessor(options).assess(request);
}

function makeBrowserFailureEvidence(input: {
  id: string;
  assessmentId: string;
  pageId: string;
  completedAt: string;
  failure: Extract<Awaited<ReturnType<BrowserLoader['load']>>, { status: 'failed' }>;
}): Evidence {
  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: input.id,
    assessmentId: input.assessmentId,
    pageId: input.pageId,
    kind: 'raw_browser_result',
    source: {
      type: 'browser',
      name: input.failure.automationName,
      version: input.failure.automationVersion,
    },
    capturedAt: input.completedAt,
    contentType: 'application/json',
    payload: {
      status: 'failed',
      requestedUrl: input.failure.requestedUrl,
      attemptedAt: input.failure.attemptedAt,
      error: input.failure.error,
    },
    metadata: { captureStatus: 'failed' },
  };
}
