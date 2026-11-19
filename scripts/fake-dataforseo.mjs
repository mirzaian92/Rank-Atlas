// Local fake DataForSEO server for testing the integration pipeline without paid requests.
// Usage: node scripts/fake-dataforseo.mjs  (listens on :4010)
// Then run the app with DATAFORSEO_BASE_URL_OVERRIDE=http://localhost:4010 (development only).
import http from "node:http";

const metrics = (k) => ({ pos_1: 120 * k, pos_2_3: 300 * k, pos_4_10: 900 * k, pos_11_20: 1200 * k, pos_21_30: 800 * k, pos_31_40: 700 * k, pos_41_50: 600 * k, pos_51_60: 500 * k, pos_61_70: 400 * k, pos_71_80: 300 * k, pos_81_90: 200 * k, pos_91_100: 100 * k, etv: 54321 * k, count: 6120 * k, estimated_paid_traffic_cost: 98765 * k, is_new: 210, is_up: 640, is_down: 580, is_lost: 190 });
const labs = (items, total = items.length) => [{ target: "fake.com", location_code: 2840, language_code: "en", total_count: total, items_count: items.length, items }];

const RESULTS = {
  "/v3/dataforseo_labs/google/domain_rank_overview/live": () => labs([{ se_type: "google", location_code: 2840, language_code: "en", metrics: { organic: metrics(1), paid: { etv: 1200, count: 85, estimated_paid_traffic_cost: 3400 } } }]),
  "/v3/dataforseo_labs/google/historical_rank_overview/live": () => labs(Array.from({ length: 6 }, (_, i) => ({ se_type: "google", year: 2026, month: 6 + i, metrics: { organic: metrics(0.8 + i * 0.04), paid: { etv: 1000 + i * 40, count: 70 + i } } }))),
  // Paged: honours limit/offset; total_count stays 230 (the fake ignores filters but logs them).
  "/v3/dataforseo_labs/google/ranked_keywords/live": (task) => {
    const all = Array.from({ length: 230 }, (_, i) => ({
      se_type: "google",
      keyword_data: { keyword: i === 0 ? "fake" : `fake keyword ${i}`, keyword_info: { search_volume: 50000 - i * 200, cpc: 1 + (i % 7), competition: 0.4 }, keyword_properties: { keyword_difficulty: (i * 7) % 100 }, search_intent_info: { main_intent: ["informational", "navigational", "commercial", "transactional"][i % 4] } },
      ranked_serp_element: { serp_item: { type: "organic", rank_group: 1 + (i % 60), rank_absolute: 1 + (i % 60), url: `https://fake.com/p/${i % 12}`, etv: Math.max(1, 12000 - i * 50), rank_changes: { previous_rank_absolute: i % 5 ? 2 + (i % 60) : null, is_new: i % 5 === 0, is_up: true, is_down: false } }, serp_item_types: i % 3 ? ["organic"] : ["organic", "video"], last_updated_time: "2026-11-10 08:00:00 +00:00" },
    }));
    const off = task.offset ?? 0, lim = task.limit ?? 100;
    return labs(all.slice(off, off + lim), 230);
  },
  "/v3/dataforseo_labs/google/competitors_domain/live": () => labs([
    { se_type: "google", domain: "fake.com", avg_position: 10, sum_position: 1, intersections: 6120, full_domain_metrics: { organic: metrics(1) } },
    { se_type: "google", domain: "rival.io", avg_position: 14.2, sum_position: 1, intersections: 900, full_domain_metrics: { organic: metrics(0.5) } },
  ]),
  "/v3/dataforseo_labs/google/relevant_pages/live": (task) => {
    const all = Array.from({ length: 40 }, (_, i) => ({ page_address: `https://fake.com/p/${i}`, metrics: { organic: { count: 300 - i * 5, etv: 20000 - i * 400 } } }));
    const off = task.offset ?? 0, lim = task.limit ?? 100;
    return labs(all.slice(off, off + lim), 40);
  },
  "/v3/dataforseo_labs/google/keyword_overview/live": (task) =>
    labs((task.keywords ?? []).filter((k) => !k.includes("nodata")).map((k, i) => fakeKeyword(k, i))),
  // Paged (limit/offset); questions when a regex filter is present; total_count fixed per list.
  "/v3/dataforseo_labs/google/keyword_suggestions/live": (task) => {
    const q = JSON.stringify(task.filters ?? "").includes("regex");
    const pre = q ? ["how to use", "what is", "why use", "is", "can i use", "where to buy"] : ["best", "free", "cheap", "top", "online", "pro", "simple", "open source"];
    const all = Array.from({ length: q ? 60 : 180 }, (_, i) => fakeKeyword(`${pre[i % pre.length]} ${task.keyword}${i >= pre.length ? ` ${["for teams", "app", "pricing", "review", "2026"][i % 5]} ${i}` : ""}`, i));
    const off = task.offset ?? 0, lim = task.limit ?? 100;
    return labs(all.slice(off, off + lim), all.length);
  },
  "/v3/dataforseo_labs/google/related_keywords/live": (task) => {
    const all = Array.from({ length: 90 }, (_, i) => ({ se_type: "google", depth: 1 + (i % 2), keyword_data: fakeKeyword(`related topic ${i} ${task.keyword.split(" ")[0]}`, i) }));
    const off = task.offset ?? 0, lim = task.limit ?? 100;
    return labs(all.slice(off, off + lim), all.length);
  },
  "/v3/dataforseo_labs/google/keyword_ideas/live": (task) => {
    const all = Array.from({ length: 120 }, (_, i) => fakeKeyword(`${["tool", "platform", "service", "suite"][i % 4]} idea ${i}`, i));
    const off = task.offset ?? 0, lim = task.limit ?? 100;
    return labs(all.slice(off, off + lim), all.length);
  },
  "/v3/serp/google/organic/live/advanced": (task) => [{
    keyword: task.keyword, se_results_count: 1830000, item_types: ["organic", "people_also_ask"],
    items: [
      { type: "organic", rank_group: 1, rank_absolute: 1, domain: "alpha.com", title: `${task.keyword} — Alpha`, url: "https://alpha.com/x", description: "desc" },
      { type: "people_also_ask", rank_group: 1, rank_absolute: 2, items: [{ title: "q1" }] },
      { type: "organic", rank_group: 2, rank_absolute: 3, domain: "beta.io", title: `${task.keyword} guide`, url: "https://beta.io/guide", description: "desc" },
    ],
  }],
  // Each domain "ranks" for a deterministic keyword set; the fake computes intersections from those.
  "/v3/dataforseo_labs/google/domain_intersection/live": (task) => {
    const set = (d) => new Map(Array.from({ length: 400 }, (_, i) => [`kw ${(hash(d) + i * 7) % 900}`, 1 + ((hash(d) + i) % 80)]));
    const a = set(task.target1), b = set(task.target2);
    const keys = [...a.keys()].filter((k) => (task.intersections ? b.has(k) : !b.has(k)));
    const items = keys.map((k) => ({
      se_type: "google",
      keyword_data: fakeKeyword(k, Number(k.split(" ")[1]) % 40),
      first_domain_serp_element: { type: "organic", rank_group: a.get(k), url: `https://${task.target1}/x` },
      second_domain_serp_element: task.intersections ? { type: "organic", rank_group: b.get(k), url: `https://${task.target2}/x` } : null,
    })).sort((x, y) => y.keyword_data.keyword_info.search_volume - x.keyword_data.keyword_info.search_volume);
    return labs(items.slice(0, task.limit ?? 100), items.length);
  },
  "/v3/backlinks/summary/live": () => [{ target: "fake.com", rank: 48, backlinks: 120000, backlinks_spam_score: 4, broken_backlinks: 30, referring_domains: 2100, referring_domains_nofollow: 300, referring_main_domains: 1900, referring_ips: 1700, referring_subnets: 1400, referring_links_tld: { com: 1200, org: 300 }, referring_links_types: { anchor: 110000 }, referring_links_attributes: { nofollow: 20000 } }],
  "/v3/backlinks/anchors/live": (task) => {
    const all = Array.from({ length: 70 }, (_, i) => ({ anchor: i === 0 ? "" : `anchor text ${i}`, backlinks: 5000 - i * 60, referring_domains: 400 - i * 5, referring_links_attributes: { nofollow: i * 10 }, first_seen: "2024-03-01 00:00:00 +00:00" }));
    return [{ total_count: all.length, items: all.slice(task.offset ?? 0, (task.offset ?? 0) + (task.limit ?? 100)) }];
  },
  "/v3/backlinks/history/live": () => [{ total_count: 6, items: Array.from({ length: 6 }, (_, i) => ({ date: `2026-${String(5 + i).padStart(2, "0")}-01 00:00:00 +00:00`, backlinks: 100000 + i * 4000, referring_domains: 1800 + i * 60, new_referring_domains: 90 + i, lost_referring_domains: 40 + i })) }],
  "/v3/backlinks/backlinks/live": (task) => {
    const lost = task.backlinks_status_type === "lost";
    const all = Array.from({ length: lost ? 40 : 260 }, (_, i) => ({
      type: "backlink", domain_from: `site${i}.com`, url_from: `https://site${i}.com/post/${i}`, url_to: `https://${task.target}/`, page_from_title: `Post ${i}`,
      domain_from_rank: 90 - (i % 90), item_type: i % 9 === 0 ? "image" : "anchor", dofollow: i % 4 !== 0, anchor: `anchor ${i}`,
      first_seen: "2025-01-15 10:00:00 +00:00", last_seen: "2026-11-10 08:00:00 +00:00", is_new: i % 11 === 0, is_lost: lost,
    }));
    return [{ total_count: all.length, items: all.slice(task.offset ?? 0, (task.offset ?? 0) + (task.limit ?? 100)) }];
  },
  "/v3/backlinks/referring_domains/live": (task) => {
    const all = Array.from({ length: 1400 }, (_, i) => ({
      type: "backlinks_referring_domain", domain: i % 50 === 7 ? `spammy${i}.xyz` : `ref${i}.com`, rank: 90 - (i % 90), backlinks: 3000 - i * 2,
      first_seen: "2024-06-01 00:00:00 +00:00", backlinks_spam_score: (i * 13) % 100, referring_links_attributes: { nofollow: i % 3 },
    }));
    return [{ total_count: all.length, items: all.slice(task.offset ?? 0, (task.offset ?? 0) + (task.limit ?? 100)) }];
  },
  "/v3/backlinks/bulk_spam_score/live": (task) => [{ items_count: (task.targets ?? []).length, items: (task.targets ?? []).map((t) => ({ target: t, spam_score: t.endsWith(".xyz") ? 85 : hash(t) % 40 })) }],
  // Referring-domain sets per target; computes all/partial intersections with exclusions.
  "/v3/backlinks/domain_intersection/live": (task) => {
    const refs = (d) => new Set(Array.from({ length: 150 }, (_, i) => `ref${(hash(d) + i * 3) % 400}.org`));
    const keys = Object.keys(task.targets ?? {});
    const sets = keys.map((k) => refs(task.targets[k]));
    const excluded = (task.exclude_targets ?? []).map(refs);
    const universe = new Set(sets.flatMap((x) => [...x]));
    const ok = [...universe].filter((r) => (task.intersection_mode === "partial" ? sets.some((s) => s.has(r)) : sets.every((s) => s.has(r))) && !excluded.some((s) => s.has(r)));
    const items = ok.map((r) => ({ domain_intersection: Object.fromEntries(keys.map((k, i) => [k, sets[i].has(r) ? { type: "backlinks_domain_intersection", domain: r, rank: hash(r) % 100, backlinks: 1 + (hash(r + k) % 50) } : null])) }))
      .sort((a, b) => Object.values(b.domain_intersection).find(Boolean).rank - Object.values(a.domain_intersection).find(Boolean).rank);
    return [{ total_count: items.length, items: items.slice(task.offset ?? 0, (task.offset ?? 0) + (task.limit ?? 100)) }];
  },
  "/v3/appendix/user_data": () => [{ login: "fake@example.com", timezone: "UTC", money: { total: 50, balance: 42.5 } }],
};

const fakeKeyword = (keyword, i) => ({
  se_type: "google", keyword, location_code: 2840, language_code: "en",
  keyword_info: { search_volume: Math.max(10, 9000 - i * 70), cpc: Math.round((0.8 + (i % 9) * 0.6) * 100) / 100, competition: 0.5, monthly_searches: Array.from({ length: 12 }, (_, m) => ({ year: 2026, month: 12 - m, search_volume: 8000 + m * 150 })) },
  keyword_properties: { keyword_difficulty: (30 + i * 9) % 100 },
  serp_info: { serp_item_types: ["organic", "people_also_ask"], se_results_count: 1830000 },
  search_intent_info: { main_intent: ["commercial", "informational", "transactional", "navigational"][i % 4] },
});

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

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
    const task = body ? JSON.parse(body)[0] ?? {} : {};
    res.end(JSON.stringify(envelope(20000, "Ok.", fn(task), req.url.includes("appendix") ? 0 : 0.0123)));
  });
}).listen(4010, () => console.log("fake DataForSEO on :4010"));
