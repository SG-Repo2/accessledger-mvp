import { z } from 'zod';

import { entityIdSchema, schemaVersionSchema } from './common.js';
import { evidenceSchema } from './evidence.js';

export const accessibilityTargetDescriptorSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: entityIdSchema,
  strategy: z.literal('css'),
  selector: z.string().trim().min(1),
  sourceEvidenceId: entityIdSchema.nullable(),
});

export const accessibilityCollectionContextSchema = z.object({
  assessmentId: entityIdSchema,
  pageId: entityIdSchema,
  rawEvidenceIds: z.array(entityIdSchema).min(1),
});

const unavailableFieldSchema = z.object({
  status: z.literal('unavailable'),
  reason: z.literal('not_exposed_or_not_applicable'),
});

const availableTextFieldSchema = z.object({
  status: z.literal('available'),
  value: z.string(),
});

const availablePrimitiveFieldSchema = z.object({
  status: z.literal('available'),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const availableBooleanFieldSchema = z.object({
  status: z.literal('available'),
  value: z.boolean(),
});

export const accessibilityTextFieldSchema = z.union([
  availableTextFieldSchema,
  unavailableFieldSchema,
]);

export const accessibilityPrimitiveFieldSchema = z.union([
  availablePrimitiveFieldSchema,
  unavailableFieldSchema,
]);

export const accessibilityBooleanFieldSchema = z.union([
  availableBooleanFieldSchema,
  unavailableFieldSchema,
]);

export const accessibilityRelationshipTargetSchema = z.object({
  idref: z.string().nullable(),
  text: z.string().nullable(),
});

export const accessibilityRelationshipFieldSchema = z.union([
  z.object({
    status: z.literal('available'),
    value: z.array(accessibilityRelationshipTargetSchema),
  }),
  unavailableFieldSchema,
]);

export const accessibilitySemanticsSchema = z.object({
  role: accessibilityTextFieldSchema,
  name: accessibilityTextFieldSchema,
  description: accessibilityTextFieldSchema,
  value: accessibilityPrimitiveFieldSchema,
  focusable: accessibilityBooleanFieldSchema,
  states: z.object({
    busy: accessibilityPrimitiveFieldSchema,
    disabled: accessibilityPrimitiveFieldSchema,
    focused: accessibilityPrimitiveFieldSchema,
    invalid: accessibilityPrimitiveFieldSchema,
    readOnly: accessibilityPrimitiveFieldSchema,
    required: accessibilityPrimitiveFieldSchema,
    checked: accessibilityPrimitiveFieldSchema,
    expanded: accessibilityPrimitiveFieldSchema,
    modal: accessibilityPrimitiveFieldSchema,
    pressed: accessibilityPrimitiveFieldSchema,
    selected: accessibilityPrimitiveFieldSchema,
  }),
  relationships: z.object({
    activeDescendant: accessibilityRelationshipFieldSchema,
    controls: accessibilityRelationshipFieldSchema,
    describedBy: accessibilityRelationshipFieldSchema,
    details: accessibilityRelationshipFieldSchema,
    errorMessage: accessibilityRelationshipFieldSchema,
    flowTo: accessibilityRelationshipFieldSchema,
    labelledBy: accessibilityRelationshipFieldSchema,
    owns: accessibilityRelationshipFieldSchema,
  }),
});

export const accessibilitySemanticsProvenanceSchema = z.object({
  classification: z.literal('browser_accessibility_semantics'),
  apiName: z.literal('Chrome DevTools Protocol Accessibility'),
  apiVersion: z.string().trim().min(1).nullable(),
  browserName: z.string().trim().min(1),
  browserVersion: z.string().trim().min(1),
  automationName: z.string().trim().min(1),
  automationVersion: z.string().trim().min(1),
  assistiveTechnologyOutput: z.literal(false),
});

const accessibilitySemanticsPayloadBaseSchema = z.object({
  schemaVersion: schemaVersionSchema,
  target: accessibilityTargetDescriptorSchema,
  provenance: accessibilitySemanticsProvenanceSchema,
});

export const accessibilitySemanticsErrorSchema = z.object({
  code: z.enum([
    'target_not_found_or_detached',
    'multiple_targets_matched',
    'hidden_target',
    'accessibility_node_unavailable',
    'browser_api_error',
  ]),
  message: z.string().trim().min(1),
});

export const accessibilitySemanticsPayloadSchema = z.discriminatedUnion('collectionStatus', [
  accessibilitySemanticsPayloadBaseSchema.extend({
    collectionStatus: z.literal('collected'),
    semantics: accessibilitySemanticsSchema,
    error: z.null(),
  }),
  accessibilitySemanticsPayloadBaseSchema.extend({
    collectionStatus: z.literal('error'),
    semantics: z.null(),
    error: accessibilitySemanticsErrorSchema,
  }),
]);

export const accessibilitySemanticsEvidenceMetadataSchema = z.object({
  targetId: entityIdSchema,
  rawEvidenceIds: z.array(entityIdSchema).min(1),
  sourceEvidenceId: entityIdSchema.nullable(),
});

export const accessibilitySemanticsEvidenceSchema = evidenceSchema
  .extend({
    pageId: entityIdSchema,
    kind: z.literal('accessibility_semantics'),
    source: z.object({
      type: z.literal('accessibility_api'),
      name: z.literal('Chrome DevTools Protocol Accessibility'),
      version: z.string().trim().min(1).nullable(),
    }),
    payload: accessibilitySemanticsPayloadSchema,
    metadata: accessibilitySemanticsEvidenceMetadataSchema,
  })
  .superRefine((evidence, context) => {
    if (evidence.source.version !== evidence.payload.provenance.apiVersion) {
      context.addIssue({
        code: 'custom',
        path: ['source', 'version'],
        message: 'Accessibility evidence source and payload API versions must match.',
      });
    }
    if (
      evidence.metadata.targetId !== evidence.payload.target.id ||
      evidence.metadata.sourceEvidenceId !== evidence.payload.target.sourceEvidenceId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['metadata'],
        message: 'Accessibility evidence metadata must match its target descriptor.',
      });
    }
  });

export type AccessibilityTargetDescriptor = z.infer<typeof accessibilityTargetDescriptorSchema>;
export type AccessibilityCollectionContext = z.infer<typeof accessibilityCollectionContextSchema>;
export type AccessibilityPrimitiveField = z.infer<typeof accessibilityPrimitiveFieldSchema>;
export type AccessibilityRelationshipField = z.infer<typeof accessibilityRelationshipFieldSchema>;
export type AccessibilitySemantics = z.infer<typeof accessibilitySemanticsSchema>;
export type AccessibilitySemanticsError = z.infer<typeof accessibilitySemanticsErrorSchema>;
export type AccessibilitySemanticsPayload = z.infer<typeof accessibilitySemanticsPayloadSchema>;
export type AccessibilitySemanticsEvidence = z.infer<typeof accessibilitySemanticsEvidenceSchema>;
