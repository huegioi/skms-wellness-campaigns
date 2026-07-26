/**
 * Shared email-domain utilities for client matching, dedupe, and linking.
 * Used by backfillClientEmailDomain, createMfsAssessment, backfillInvoiceClientIds,
 * and any other path that needs to derive an organization identity key from an email.
 */

// Free-mail providers — identify a person, not an organization.
// Also excludes SkillfulMeans' own domain (internal/test accounts, never a client org).
export const EXCLUDED_DOMAINS = new Set([
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'skillfulmeans.life',
]);

/**
 * Extracts the lowercased domain from an email address.
 * Returns null if the email is empty, malformed, or has no domain part.
 */
export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  const atIdx = email.indexOf('@');
  if (atIdx === -1) return null;
  const domain = email.slice(atIdx + 1).toLowerCase().trim();
  return domain || null;
}

/**
 * Returns the organization identity key (email_domain) for a given email.
 * Returns null if the domain is a free-mail provider or the SkillfulMeans
 * own domain, because those identify a person rather than an organization.
 */
export function getOrgDomain(email: string | null | undefined): string | null {
  const domain = extractEmailDomain(email);
  if (!domain) return null;
  if (EXCLUDED_DOMAINS.has(domain)) return null;
  return domain;
}

/**
 * Returns true if the domain is excluded (free-mail or SkillfulMeans own).
 */
export function isExcludedDomain(domain: string | null | undefined): boolean {
  if (!domain) return true;
  return EXCLUDED_DOMAINS.has(domain);
}

/**
 * Derives a provisional company name from an email domain.
 * e.g. "cocana@silverhillhospital.org" → "Silverhillhospital"
 * Returns null if the domain is excluded or unavailable.
 */
export function deriveCompanyFromEmail(email: string | null | undefined): string | null {
  const domain = getOrgDomain(email);
  if (!domain) return null;
  // Take the part before the TLD (last segment after the final dot)
  const parts = domain.split('.');
  if (parts.length < 2) return domain;
  // Use the main domain part, capitalized
  const main = parts[parts.length - 2];
  return main.charAt(0).toUpperCase() + main.slice(1);
}

/**
 * Sanitizes a list of email_domain_aliases at write time.
 * Strips out excluded (free-mail / internal) domains and logs each rejection
 * so a hand-entered gmail.com alias can never silently capture every
 * free-mail customer in the domain index.
 *
 * Call this wherever aliases are persisted on a Client or Brokerage record.
 * Returns the clean alias list (deduped, lowercased, trimmed).
 */
export function sanitizeEmailDomainAliases(
  aliases: string[] | null | undefined,
  context?: { record_id?: string; record_type?: string }
): string[] {
  if (!aliases || !Array.isArray(aliases)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of aliases) {
    const d = String(raw).toLowerCase().trim();
    if (!d) continue;
    if (seen.has(d)) continue;
    seen.add(d);
    if (EXCLUDED_DOMAINS.has(d)) {
      const label = context?.record_type
        ? `${context.record_type}${context.record_id ? ' ' + context.record_id : ''}`
        : 'record';
      console.warn(
        `[emailDomain] Rejected excluded domain "${d}" from email_domain_aliases on ${label} — free-mail/internal domains are not valid organization keys.`
      );
      continue;
    }
    clean.push(d);
  }
  return clean;
}

/**
 * Builds the two-pass domain index used by quickbooksSync and
 * backfillInvoiceClientIds to match invoices/contacts to Clients.
 *
 * Returns:
 *   domainToClient   — Map<domain, Client>  (only unambiguous domains)
 *   emailToClient    — Map<email, Client>   (exact-email fallback)
 *   ambiguousDomains — Array<{ domain, client_count, clients }>
 *
 * Aliases (email_domain_aliases) are treated as additional primary-style
 * keys. A collision between an alias and a primary (or two aliases) is
 * ambiguous exactly like a primary-primary collision — no silent outrank.
 * Excluded (free-mail/internal) domains in aliases are skipped and logged.
 * Records predating the email_domain_aliases field (undefined) are safe —
 * the || [] fallback handles them.
 */
export function buildClientDomainIndex(clients: any[]) {
  const domainToClient = new Map();
  const emailToClient = new Map();
  const ambiguousDomains: any[] = [];
  const domainToClients = new Map();

  const trackDomain = (domain: string, client: any) => {
    const d = String(domain).toLowerCase().trim();
    if (!d) return;
    // Safety net — never index a free-mail/internal domain even if it
    // somehow reached here as a stored email_domain value.
    if (EXCLUDED_DOMAINS.has(d)) return;
    if (!domainToClients.has(d)) domainToClients.set(d, []);
    domainToClients.get(d).push(client);
  };

  for (const c of clients) {
    if (c.email) {
      const ek = c.email.toLowerCase().trim();
      if (!emailToClient.has(ek)) emailToClient.set(ek, c);
    }
    const domain = c.email_domain || getOrgDomain(c.email);
    if (domain) trackDomain(domain, c);
    // Aliases — || [] handles records that predate the field (undefined).
    const aliases = c.email_domain_aliases || [];
    for (const alias of aliases) {
      const d = String(alias).toLowerCase().trim();
      if (!d) continue;
      if (EXCLUDED_DOMAINS.has(d)) {
        console.warn(
          `[emailDomain] Skipping excluded alias "${d}" on client ${c.id} (${c.company || c.name || 'unknown'}) — free-mail domains are not valid organization keys.`
        );
        continue;
      }
      trackDomain(d, c);
    }
  }

  for (const [domain, clients] of domainToClients) {
    // De-dup: a client may contribute the same domain as both primary and
    // alias — that must not inflate the count or create a false collision.
    const unique = clients.filter((c: any, i: number, arr: any[]) =>
      arr.findIndex((x: any) => x.id === c.id) === i
    );
    if (unique.length === 1) {
      domainToClient.set(domain, unique[0]);
    } else {
      ambiguousDomains.push({
        domain,
        client_count: unique.length,
        clients: unique.map((c: any) => ({ id: c.id, name: c.name, email: c.email, company: c.company }))
      });
    }
  }

  return { domainToClient, emailToClient, ambiguousDomains };
}