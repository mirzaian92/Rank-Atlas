/**
 * Large general-purpose sites that appear as "competitors" for almost any domain because they rank
 * for everything. Hidden by default in Organic Competitors (toggleable); filtered locally, so it does
 * not depend on provider-side options.
 */
export const GENERIC_DOMAINS = new Set([
  "wikipedia.org", "en.wikipedia.org", "youtube.com", "www.youtube.com", "reddit.com", "www.reddit.com", "quora.com",
  "www.quora.com", "facebook.com", "www.facebook.com", "linkedin.com", "www.linkedin.com", "pinterest.com",
  "www.pinterest.com", "instagram.com", "www.instagram.com", "x.com", "twitter.com", "amazon.com", "www.amazon.com",
  "medium.com", "tiktok.com", "www.tiktok.com", "google.com", "support.google.com", "apple.com", "microsoft.com",
  "forbes.com", "www.forbes.com", "nytimes.com", "yelp.com", "www.yelp.com", "github.com", "indeed.com", "ebay.com",
]);

export function isGenericDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  if (GENERIC_DOMAINS.has(d)) return true;
  // Subdomains of the above, e.g. de.wikipedia.org
  for (const g of GENERIC_DOMAINS) if (d.endsWith(`.${g.replace(/^www\./, "")}`)) return true;
  return false;
}
