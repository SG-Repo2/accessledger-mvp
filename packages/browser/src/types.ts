import type { JsonValue, RawPageAssessmentError } from '@accessledger/shared';

export type BrowserLoadRequest = {
  url: string;
  timeoutMs?: number;
};

export type BrowserNavigationData = {
  httpStatus: number | null;
  responseHeaders: Record<string, string>;
};

export type BrowserCaptureData = {
  requestedUrl: string;
  finalUrl: string;
  title: string;
  language: string | null;
  loadedAt: string;
  browserName: string;
  browserVersion: string;
  automationName: string;
  automationVersion: string;
  navigation: BrowserNavigationData;
};

/**
 * A live, non-serializable browser capability. The Playwright Page is deliberately private to the
 * browser package; downstream scanners can inject and evaluate scripts without receiving it.
 */
export interface BrowserCapture {
  readonly data: BrowserCaptureData;
  readonly closed: boolean;
  injectScript(content: string): Promise<void>;
  evaluate<T extends JsonValue>(expression: string): Promise<T>;
  close(): Promise<void>;
}

export type BrowserLoadFailure = {
  status: 'failed';
  requestedUrl: string;
  attemptedAt: string;
  automationName: string;
  automationVersion: string;
  error: RawPageAssessmentError;
};

export type BrowserLoadResult = { status: 'loaded'; capture: BrowserCapture } | BrowserLoadFailure;

export interface BrowserLoader {
  load(request: BrowserLoadRequest): Promise<BrowserLoadResult>;
}
