/**
 * Domain validation for custom domain input.
 *
 * Checks:
 * - Valid FQDN format (hostname.tld)
 * - Not an IP address
 * - Not self-referencing (no "getflowetic" in domain)
 * - Has a valid TLD
 * - Reasonable length limits
 */

const BLOCKED_PATTERNS = [
  'getflowetic',
  'flowetic',
  'vercel.app',
  'vercel-dns.com',
  'localhost',
];

const MAX_DOMAIN_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

// Basic FQDN: at least two labels separated by dots, each label alphanumeric + hyphens
const FQDN_REGEX = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/;

// IPv4 pattern
const IPV4_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

// IPv6 pattern (simplified — catches common forms)
const IPV6_REGEX = /^\[?[0-9a-fA-F:]+\]?$/;

export interface DomainValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDomain(domain: string): DomainValidationResult {
  // Normalize
  const cleaned = domain.trim().toLowerCase().replace(/\.$/, ''); // strip trailing dot

  if (!cleaned) {
    return { valid: false, error: 'Domain cannot be empty' };
  }

  if (cleaned.length > MAX_DOMAIN_LENGTH) {
    return { valid: false, error: `Domain exceeds ${MAX_DOMAIN_LENGTH} character limit` };
  }

  // Check for IP addresses
  if (IPV4_REGEX.test(cleaned) || IPV6_REGEX.test(cleaned)) {
    return { valid: false, error: 'IP addresses are not allowed. Use a domain name.' };
  }

  // Check FQDN format
  if (!FQDN_REGEX.test(cleaned)) {
    return {
      valid: false,
      error: 'Invalid domain format. Use a valid domain like portal.youragency.com',
    };
  }

  // Check individual label lengths
  const labels = cleaned.split('.');
  for (const label of labels) {
    if (label.length > MAX_LABEL_LENGTH) {
      return {
        valid: false,
        error: `Domain label "${label}" exceeds ${MAX_LABEL_LENGTH} character limit`,
      };
    }
  }

  // Must have at least 2 labels (subdomain.tld or domain.tld)
  if (labels.length < 2) {
    return { valid: false, error: 'Domain must include a TLD (e.g., .com, .agency)' };
  }

  // Block self-referencing domains
  for (const pattern of BLOCKED_PATTERNS) {
    if (cleaned.includes(pattern)) {
      return {
        valid: false,
        error: `Domain cannot contain "${pattern}". Use your own domain.`,
      };
    }
  }

  return { valid: true };
}
