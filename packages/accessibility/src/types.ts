import type { BrowserCapture } from '@accessledger/browser';
import type {
  AccessibilitySemanticsEvidence,
  AccessibilityTargetDescriptor,
} from '@accessledger/shared';

export interface AccessibilityEvidenceCollector {
  collect(
    page: BrowserCapture,
    targets: readonly AccessibilityTargetDescriptor[],
  ): Promise<AccessibilitySemanticsEvidence[]>;
}
