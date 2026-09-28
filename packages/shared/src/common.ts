import { z } from 'zod';

export const CONTRACT_SCHEMA_VERSION = '1.0.0' as const;

export const schemaVersionSchema = z.literal(CONTRACT_SCHEMA_VERSION);
export const entityIdSchema = z.string().trim().min(1);
export const urlSchema = z.url();
export const timestampSchema = z.iso.datetime({ offset: true });
export const jsonValueSchema = z.json();

export const entityTimestampsSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type JsonValue = z.infer<typeof jsonValueSchema>;
