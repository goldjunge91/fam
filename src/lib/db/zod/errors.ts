import { z } from 'zod';

/** Returns the first user-facing error per field for flat form schemas. */
export function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const flattened = z.flattenError(error);
  const fieldErrors = flattened.fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([field, messages]) =>
      messages?.[0] ? [[field, messages[0]]] : [],
    ),
  );
}
