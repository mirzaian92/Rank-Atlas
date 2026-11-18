// Local fake DataForSEO server for testing the integration pipeline without paid requests.
// Usage: node scripts/fake-dataforseo.mjs  (listens on :4010)
// Then run the app with DATAFORSEO_BASE_URL_OVERRIDE=http://localhost:4010 (development only).
import http from "node:http";

const metrics = (k) => ({ pos_1: 120 * k, pos_2_3: 300 * k, pos_4_10: 900 * k, pos_11_20: 1200 * k, pos_21_30: 800 * k, pos_31_40: 700 * k, pos_41_50: 600 * k, pos_51_60: 500 * k, pos_61_70: 400 * k, pos_71_80: 300 * k, pos_81_90: 200 * k, pos_91_100: 100 * k, etv: 54321 * k, count: 6120 * k, estimated_paid_traffic_cost: 98765 * k, is_new: 210, is_up: 640, is_down: 580, is_lost: 190 });
const labs = (items, total = items.length) => [{ target: "fake.com", location_code: 2840, language_code: "en", total_count: total, items_count: items.length, items }];

const RESULTS = {
  "/v3/dataforseo_labs/google/domain_rank_overview/live": () => labs([{ se_type: "google", location_code: 2840, language_code: "en", metrics: { organic: metrics(1), paid: { etv: 1200, count: 85, estimated_paid_traffic_cost: 3400 } } }]),
  "/v3/dataforseo_labs/google/historical_rank_overview/live": () => labs(Array.from({ length: 6 }, (_, i) => ({ se_type: "google", year: 2026, month: 6 + i, metrics: { organic: metrics(0.8 + i * 0.04), paid: { etv: 1000 + i * 40, count: 70 + i } } }))),
  "/v3/dataforseo_labs/google/ranked_keywords/live": () => labs([
    { se_type: "google", keyword_data: { keyword: "fake widgets", keyword_info: { search_volume: 9900, cpc: 2.4, competition: 0.6 }, keyword_properties: { keyword_difficulty: 41 }, search_intent_info: { main_intent: "commercial" } }, ranked_serp_element: { serp_item: { type: "organic", rank_group: 2, rank_absolute: 3, url: "https://fake.com/widgets", etv: 1500, rank_changes: { previous_rank_absolute: 5, is_new: false, is_up: true, is_down: false } }, serp_item_types: ["organic", "people_also_ask"], last_updated_time: "2026-11-10 08:00:00 +00:00" } },
    { se_type: "google", keyword_data: { keyword: "fake", keyword_info: { search_volume: 40500, cpc: 1.1, competition: 0.2 }, keyword_properties: { keyword_difficulty: 77 }, search_intent_info: { main_intent: "navigational" } }, ranked_serp_element: { serp_item: { type: "organic", rank_group: 1, rank_absolute: 1, url: "https://fake.com/", etv: 12000, rank_changes: { previous_rank_absolute: 1, is_new: false, is_up: false, is_down: false } }, serp_item_types: ["organic"], last_updated_time: null } },
  ], 6120),
  "/v3/dataforseo_labs/google/competitors_domain/live": () => labs([
    { se_type: "google", domain: "fake.com", avg_position: 10, sum_position: 1, intersections: 6120, full_domain_metrics: { organic: metrics(1) } },
    { se_type: "google", domain: "rival.io", avg_position: 14.2, sum_position: 1, intersections: 900, full_domain_metrics: { organic: metrics(0.5) } },
  ]),
  "/v3/dataforseo_labs/google/relevant_pages/live": () => labs([{ page_address: "https://fake.com/", metrics: { organic: { count: 300, etv: 20000 } } }]),
  "/v3/backlinks/summary/live": () => [{ target: "fake.com", rank: 48, backlinks: 120000, backlinks_spam_score: 4, broken_backlinks: 30, referring_domains: 2100, referring_domains_nofollow: 300, referring_main_domains: 1900, referring_ips: 1700, referring_subnets: 1400, referring_links_tld: { com: 1200, org: 300 }, referring_links_types: { anchor: 110000 }, referring_links_attributes: { nofollow: 20000 } }],
  "/v3/backlinks/anchors/live": () => [{ total_count: 1, items: [{ anchor: "fake", backlinks: 5000, referring_domains: 400 }] }],
  "/v3/appendix/user_data": () => [{ login: "fake@example.com", timezone: "UTC", money: { total: 50, balance: 42.5 } }],
};

let calls = 0;
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    calls++;
    const auth = req.headers.authorization ?? "";
    const fn = RESULTS[req.url];
    const envelope = (status_code, status_message, result, cost) => ({
      version: "0.1.fake", status_code, status_message, time: "0.01 sec.", cost, tasks_count: 1, tasks_error: status_code === 20000 ? 0 : 1,
      tasks: [{ id: `fake-${calls}`, status_code, status_message, time: "0.01 sec.", cost, result_count: result?.length ?? 0, path: req.url.split("/").filter(Boolean), data: body ? JSON.parse(body)[0] : {}, result }],
    });
    res.setHeader("Content-Type", "application/json");
    if (!auth.startsWith("Basic ")) return res.end(JSON.stringify(envelope(40100, "You are not authorized to access this resource.", null, 0)));
    if (!fn) return res.end(JSON.stringify(envelope(40400, "Not Found.", null, 0)));
    console.log("fake hit", req.method, req.url, body.slice(0, 160));
    res.end(JSON.stringify(envelope(20000, "Ok.", fn(), req.url.includes("appendix") ? 0 : 0.0123)));
  });
}).listen(4010, () => console.log("fake DataForSEO on :4010"));
