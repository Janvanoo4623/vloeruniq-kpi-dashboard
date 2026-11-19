import { createHash } from 'node:crypto';

/** Hash van de planning-sleutel; alleen de hash staat in Supabase. */
export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
