/** Neutral vocabulary used to build MOCK keyword strings. */
export const MODIFIERS_PRE = ["best", "cheap", "free", "top", "online", "how to use", "what is", "buy", "compare", "affordable"];
export const MODIFIERS_POST = ["pricing", "reviews", "login", "alternatives", "near me", "for beginners", "app", "tutorial", "vs competitors", "discount code", "features", "guide", "examples", "2026", "software", "templates", "support", "download"];
export const QUESTIONS = ["how does", "why is", "what is the best", "can i", "is", "how much does", "where to find", "when should i use"];
export const TOPICS = ["analytics", "marketing", "dashboard", "project management", "crm", "email", "invoice", "accounting", "website builder", "hosting", "design", "seo", "automation", "payroll", "scheduling", "ecommerce", "inventory", "help desk"];
export const SERP_FEATURES = ["featured_snippet", "people_also_ask", "images", "video", "local_pack", "top_stories", "knowledge_graph", "related_searches", "sitelinks", "shopping"];
export const PAGE_PATHS = ["/", "/pricing", "/blog", "/features", "/blog/getting-started", "/blog/guide", "/templates", "/integrations", "/about", "/help", "/compare", "/solutions/teams", "/resources", "/login", "/signup"];
export const COMPETITOR_STEMS = ["northwind", "brightpath", "lumen", "orbitly", "stackwise", "clearbase", "nimbus", "fieldnote", "harborly", "quantify", "pixelcraft", "trellis", "vantly", "everstack", "fernhill"];
export const TLDS = [".com", ".io", ".co", ".net", ".org", ".app"];
export const ANCHORS = ["click here", "learn more", "this tool", "official site", "read the guide", "homepage", "website", "pricing page"];

export function domainStem(domain: string): string {
  return domain.split(".")[0].replace(/[^a-z0-9]/g, " ").trim() || "brand";
}
