import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getOrgDomain, extractEmailDomain } from '../../shared/emailDomain.ts';

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Forbidden — team members only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default true

    // ── Fetch all invoices and clients ──
    const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
    const allClients = await base44.asServiceRole.entities.Client.list('-created_date', 1000);

    // Build lookup indexes:
    // 1. email_domain → client (primary — organization identity key)
    //    If multiple clients share a domain, it's ambiguous — store null so we
    //    fall back to exact-email matching for those invoices, and report them.
    // 2. exact email → client (fallback for free-mail / null-domain / ambiguous domains)
    const domainToClient = new Map();
    const emailToClient = new Map();
    const ambiguousDomains = [];
    // First pass: collect all clients per domain
    const domainToClients = new Map();
    for (const c of allClients) {
      if (c.email) {
        const emailKey = c.email.toLowerCase().trim();
        if (!emailToClient.has(emailKey)) {
          emailToClient.set(emailKey, c);
        }
      }
      const domain = c.email_domain || getOrgDomain(c.email);
      if (domain) {
        if (!domainToClients.has(domain)) {
          domainToClients.set(domain, []);
        }
        domainToClients.get(domain).push(c);
      }
    }
    // Second pass: only map unambiguous domains; flag ambiguous ones
    for (const [domain, clients] of domainToClients) {
      if (clients.length === 1) {
        domainToClient.set(domain, clients[0]);
      } else {
        ambiguousDomains.push({
          domain,
          client_count: clients.length,
          clients: clients.map(c => ({ id: c.id, name: c.name, email: c.email, company: c.company }))
        });
      }
    }

    // ── Phase 1: Backfill client_id on invoices where it's null and client_email is set ──
    const orphanInvoices = allInvoices.filter(inv => !inv.client_id && inv.client_email);
    const matched = [];
    const unmatchedMap = new Map(); // email → { invoice_count, total, invoices: [] }

    for (const inv of orphanInvoices) {
      const emailKey = (inv.client_email || '').toLowerCase().trim();
      // Try domain-based matching first (organization identity key),
      // then fall back to exact email for free-mail / null-domain records.
      const invoiceDomain = getOrgDomain(inv.client_email);
      const client = (invoiceDomain && domainToClient.get(invoiceDomain)) || emailToClient.get(emailKey);

      if (client) {
        matched.push({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          client_email: inv.client_email,
          client_id: client.id,
          client_name: client.name,
          total_amount: inv.total_amount
        });

        if (!dryRun) {
          await base44.asServiceRole.entities.Invoice.update(inv.id, { client_id: client.id });
        }
      } else {
        if (!unmatchedMap.has(emailKey)) {
          unmatchedMap.set(emailKey, { client_email: inv.client_email, invoice_count: 0, total: 0, invoices: [] });
        }
        const entry = unmatchedMap.get(emailKey);
        entry.invoice_count += 1;
        entry.total += inv.total_amount || 0;
        entry.invoices.push({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          total_amount: inv.total_amount,
          status: inv.status
        });
      }
    }

    const unmatched = Array.from(unmatchedMap.values()).sort((a, b) => b.total - a.total);

    // ── Phase 2: Verify each Client's invoice_ids, invoice_count, total_invoice_value ──
    // Re-fetch invoices if we just wrote (to get fresh client_id values)
    const verifyInvoices = dryRun ? allInvoices : await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);

    // Build client_id → invoices lookup
    const clientIdToInvoices = new Map();
    for (const inv of verifyInvoices) {
      if (inv.client_id) {
        if (!clientIdToInvoices.has(inv.client_id)) {
          clientIdToInvoices.set(inv.client_id, []);
        }
        clientIdToInvoices.get(inv.client_id).push(inv);
      }
    }

    const mismatches = [];
    for (const client of allClients) {
      const linkedInvoices = clientIdToInvoices.get(client.id) || [];
      const actualInvoiceIds = linkedInvoices.map(inv => inv.id);
      const actualInvoiceCount = linkedInvoices.length;
      const actualTotal = linkedInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

      const storedInvoiceIds = client.invoice_ids || [];
      const storedInvoiceCount = client.invoice_count || 0;
      const storedTotal = client.total_invoice_value || 0;

      // Compare invoice_ids (order-independent)
      const storedSet = new Set(storedInvoiceIds);
      const actualSet = new Set(actualInvoiceIds);
      const idsMatch = storedSet.size === actualSet.size && Array.from(storedSet).every(id => actualSet.has(id));
      const countMatch = storedInvoiceCount === actualInvoiceCount;
      const totalMatch = Math.abs(storedTotal - actualTotal) < 0.01;

      if (!idsMatch || !countMatch || !totalMatch) {
        mismatches.push({
          client_id: client.id,
          client_name: client.name,
          client_email: client.email,
          stored: {
            invoice_ids_count: storedInvoiceIds.length,
            invoice_count: storedInvoiceCount,
            total_invoice_value: storedTotal
          },
          actual: {
            invoice_ids: actualInvoiceIds,
            invoice_ids_count: actualInvoiceIds.length,
            invoice_count: actualInvoiceCount,
            total_invoice_value: actualTotal
          },
          differences: {
            ids_mismatch: !idsMatch,
            count_mismatch: !countMatch,
            total_mismatch: !totalMatch,
            missing_from_stored: actualInvoiceIds.filter(id => !storedSet.has(id)),
            extra_in_stored: storedInvoiceIds.filter(id => !actualSet.has(id)),
            total_diff: actualTotal - storedTotal
          }
        });
      }
    }

    return Response.json({
      dry_run: dryRun,
      backfill: {
        orphan_invoices_checked: orphanInvoices.length,
        matched: matched.length,
        unmatched: unmatched.length,
        unmatched_details: unmatched,
        matched_sample: matched.slice(0, 20), // first 20 for preview
        ambiguous_domains: ambiguousDomains
      },
      verification: {
        clients_checked: allClients.length,
        mismatches_found: mismatches.length,
        mismatches: mismatches
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});