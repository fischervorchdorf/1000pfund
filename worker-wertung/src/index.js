// Punktestand der 1000 Pfund Rallye zwischen Geräten teilen.
// Secret (nie ins Repo):  RALLYE_CODE   ->  `wrangler secret put RALLYE_CODE`
// KV-Binding:             WERTUNG       ->  siehe wrangler.toml

const ORIGINS = [
  "https://www.1000pfund-rallye.at",
  "https://1000pfund-rallye.at",
  "http://www.1000pfund-rallye.at",
  "http://1000pfund-rallye.at",
];

// Nur diese Seiten dürfen speichern, damit niemand beliebige Schlüssel anlegt.
const PAGES = ["montag", "dienstag", "mittwoch", "donnerstag",
               "freitag", "samstag", "sonntag", "wertung"];

const MAX_BYTES = 64 * 1024;

const cors = origin => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});

const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) },
  });

// Vergleich ohne frühen Abbruch, damit die Laufzeit nichts über den Code verrät.
function codeOk(given, expected) {
  if (typeof given !== "string" || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const reply = ORIGINS.includes(origin) ? origin : ORIGINS[0];

    if (request.method === "OPTIONS") return new Response(null, { headers: cors(reply) });
    if (request.method !== "POST") return json({ error: "nur POST" }, 405, reply);
    if (origin && !ORIGINS.includes(origin)) return json({ error: "fremde Herkunft" }, 403, reply);

    if (env.LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") || "unbekannt";
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ error: "zu viele Anfragen" }, 429, reply);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "kein JSON" }, 400, reply);
    }

    if (!env.RALLYE_CODE) return json({ error: "Server ohne Code eingerichtet" }, 500, reply);
    if (!codeOk(body.code, env.RALLYE_CODE)) return json({ error: "Code falsch" }, 401, reply);

    const page = String(body.page || "");
    if (!PAGES.includes(page)) return json({ error: "unbekannte Seite" }, 400, reply);
    const key = "page:" + page;

    if (body.action === "load") {
      const stored = await env.WERTUNG.get(key, "json");
      return json({ ok: true, data: stored ? stored.data : null,
                    updatedAt: stored ? stored.updatedAt : 0 }, 200, reply);
    }

    if (body.action === "save") {
      if (body.data === null || typeof body.data !== "object")
        return json({ error: "data fehlt" }, 400, reply);
      const updatedAt = Date.now();
      const payload = JSON.stringify({ data: body.data, updatedAt });
      if (payload.length > MAX_BYTES) return json({ error: "zu groß" }, 413, reply);
      await env.WERTUNG.put(key, payload);
      return json({ ok: true, updatedAt }, 200, reply);
    }

    return json({ error: "unbekannte Aktion" }, 400, reply);
  },
};
