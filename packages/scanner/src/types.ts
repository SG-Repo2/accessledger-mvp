import type { BrowserCapture } from '@accessledger/browser';
import type { JsonValue, RawPageAssessmentError } from '@accessledger/shared';

export type ScannerCapture =
  | {
      status: 'completed';
      capturedAt: string;
      scannerName: string;
      scannerVersion: string;
      rawResult: JsonValue;
    }
  | {
      status: 'failed';
      capturedAt: string;
      scannerName: string;
      scannerVersion: string;
      error: RawPageAssessmentError;
    };

export interface AccessibilityScanner {
  readonly name: string;
  readonly version: string;
  scan(capture: BrowserCapture): Promise<ScannerCapture>;
}
