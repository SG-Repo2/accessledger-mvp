import { randomUUID } from 'node:crypto';

import type { BrowserAccessibilityTreeResult, BrowserCapture } from '@accessledger/browser';
import {
  CONTRACT_SCHEMA_VERSION,
  accessibilityCollectionContextSchema,
  accessibilitySemanticsEvidenceSchema,
  accessibilityTargetDescriptorSchema,
  type AccessibilityCollectionContext,
  type AccessibilityPrimitiveField,
  type AccessibilityRelationshipField,
  type AccessibilitySemantics,
  type AccessibilitySemanticsEvidence,
  type AccessibilityTargetDescriptor,
  type JsonValue,
} from '@accessledger/shared';

import type { AccessibilityEvidenceCollector } from './types.js';

type Clock = () => Date;
type IdFactory = (target: AccessibilityTargetDescriptor) => string;

export type BrowserAccessibilityEvidenceCollectorOptions = {
  clock?: Clock;
  idFactory?: IdFactory;
};

export class BrowserAccessibilityEvidenceCollector implements AccessibilityEvidenceCollector {
  readonly #context: AccessibilityCollectionContext;
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;

  constructor(
    context: AccessibilityCollectionContext,
    options: BrowserAccessibilityEvidenceCollectorOptions = {},
  ) {
    this.#context = accessibilityCollectionContextSchema.parse(context);
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory =
      options.idFactory ?? ((target) => `accessibility-evidence-${target.id}-${randomUUID()}`);
  }

  async collect(
    page: BrowserCapture,
    targets: readonly AccessibilityTargetDescriptor[],
  ): Promise<AccessibilitySemanticsEvidence[]> {
    const validatedTargets = targets.map((target) =>
      accessibilityTargetDescriptorSchema.parse(target),
    );
    if (new Set(validatedTargets.map((target) => target.id)).size !== validatedTargets.length) {
      throw new Error('Accessibility target IDs must be unique within one collection.');
    }
    for (const target of validatedTargets) {
      if (
        target.sourceEvidenceId !== null &&
        !this.#context.rawEvidenceIds.includes(target.sourceEvidenceId)
      ) {
        throw new Error(
          `Target ${JSON.stringify(target.id)} references evidence outside the collection context.`,
        );
      }
    }

    if (validatedTargets.length === 0) return [];

    const snapshot = await page.captureAccessibilityTree(validatedTargets);
    const resultsByTarget = new Map(snapshot.results.map((result) => [result.targetId, result]));

    return validatedTargets.map((target) => {
      const result = resultsByTarget.get(target.id) ?? missingResult(target.id);
      const capturedAt = this.#clock().toISOString();
      const provenance = {
        classification: 'browser_accessibility_semantics' as const,
        apiName: snapshot.apiName,
        apiVersion: snapshot.apiVersion,
        browserName: page.data.browserName,
        browserVersion: page.data.browserVersion,
        automationName: page.data.automationName,
        automationVersion: page.data.automationVersion,
        assistiveTechnologyOutput: false as const,
      };

      return accessibilitySemanticsEvidenceSchema.parse({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: this.#idFactory(target),
        assessmentId: this.#context.assessmentId,
        pageId: this.#context.pageId,
        kind: 'accessibility_semantics',
        source: {
          type: 'accessibility_api',
          name: snapshot.apiName,
          version: snapshot.apiVersion,
        },
        capturedAt,
        contentType: 'application/json',
        payload:
          result.status === 'captured'
            ? {
                schemaVersion: CONTRACT_SCHEMA_VERSION,
                target,
                provenance,
                collectionStatus: 'collected',
                semantics: semanticsFromRawNode(result.rawNode),
                error: null,
              }
            : {
                schemaVersion: CONTRACT_SCHEMA_VERSION,
                target,
                provenance,
                collectionStatus: 'error',
                semantics: null,
                error: result.error,
              },
        metadata: {
          targetId: target.id,
          rawEvidenceIds: this.#context.rawEvidenceIds,
          sourceEvidenceId: target.sourceEvidenceId,
        },
      });
    });
  }
}

function semanticsFromRawNode(rawNode: JsonValue): AccessibilitySemantics {
  const node = asRecord(rawNode);
  const properties = Array.isArray(node.properties) ? node.properties.filter(isRecord) : [];

  return {
    role: textField(node.role),
    name: textField(node.name),
    description: textField(node.description),
    value: primitiveField(node.value),
    focusable: booleanField(findProperty(properties, 'focusable')),
    states: {
      busy: primitiveField(findProperty(properties, 'busy')),
      disabled: primitiveField(findProperty(properties, 'disabled')),
      focused: primitiveField(findProperty(properties, 'focused')),
      invalid: primitiveField(findProperty(properties, 'invalid')),
      readOnly: primitiveField(findProperty(properties, 'readonly')),
      required: primitiveField(findProperty(properties, 'required')),
      checked: primitiveField(findProperty(properties, 'checked')),
      expanded: primitiveField(findProperty(properties, 'expanded')),
      modal: primitiveField(findProperty(properties, 'modal')),
      pressed: primitiveField(findProperty(properties, 'pressed')),
      selected: primitiveField(findProperty(properties, 'selected')),
    },
    relationships: {
      activeDescendant: relationshipField(findProperty(properties, 'activedescendant')),
      controls: relationshipField(findProperty(properties, 'controls')),
      describedBy: relationshipField(findProperty(properties, 'describedby')),
      details: relationshipField(findProperty(properties, 'details')),
      errorMessage: relationshipField(findProperty(properties, 'errormessage')),
      flowTo: relationshipField(findProperty(properties, 'flowto')),
      labelledBy: relationshipField(findProperty(properties, 'labelledby')),
      owns: relationshipField(findProperty(properties, 'owns')),
    },
  };
}

function textField(value: JsonValue | undefined) {
  const primitive = axPrimitive(value);
  return typeof primitive === 'string' ? available(primitive) : unavailable();
}

function primitiveField(value: JsonValue | undefined): AccessibilityPrimitiveField {
  const primitive = axPrimitive(value);
  return primitive === undefined ? unavailable() : available(primitive);
}

function booleanField(value: JsonValue | undefined) {
  const primitive = axPrimitive(value);
  return typeof primitive === 'boolean' ? available(primitive) : unavailable();
}

function relationshipField(value: JsonValue | undefined): AccessibilityRelationshipField {
  if (!isRecord(value) || !Array.isArray(value.relatedNodes)) return unavailable();
  return {
    status: 'available',
    value: value.relatedNodes.filter(isRecord).map((relatedNode) => ({
      idref: typeof relatedNode.idref === 'string' ? relatedNode.idref : null,
      text: typeof relatedNode.text === 'string' ? relatedNode.text : null,
    })),
  };
}

function findProperty(
  properties: Record<string, JsonValue>[],
  name: string,
): JsonValue | undefined {
  return properties.find((property) => property.name === name)?.value;
}

function axPrimitive(value: JsonValue | undefined): string | number | boolean | undefined {
  if (!isRecord(value)) return undefined;
  const primitive = value.value;
  return typeof primitive === 'string' ||
    typeof primitive === 'number' ||
    typeof primitive === 'boolean'
    ? primitive
    : undefined;
}

function available<T extends string | number | boolean>(value: T) {
  return { status: 'available' as const, value };
}

function unavailable() {
  return {
    status: 'unavailable' as const,
    reason: 'not_exposed_or_not_applicable' as const,
  };
}

function asRecord(value: JsonValue): Record<string, JsonValue> {
  return isRecord(value) ? value : {};
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function missingResult(targetId: string): BrowserAccessibilityTreeResult {
  return {
    targetId,
    status: 'error',
    error: {
      code: 'browser_api_error',
      message: 'The browser accessibility API returned no result for this target.',
    },
  };
}
