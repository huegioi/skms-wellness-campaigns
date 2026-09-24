/**
 * Frontend entry point — re-exports base44/shared/resourceAvailability.ts, the
 * single definition of "when does a client get a service's resources" (only
 * after their session for it has taken place). The backend imports the same file.
 */
export { resourceAvailability } from '../../base44/shared/resourceAvailability.ts';
