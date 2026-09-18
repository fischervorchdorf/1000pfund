// Übersetzen (DeepL) und Vorlesen (Azure Speech) für 1000pfund-rallye.at/sprache
// Secrets (nie ins Repo): DEEPL_KEY, AZURE_KEY, AZURE_REGION  ->  `wrangler secret put …`

const ORIGINS = [
  "https://www.1000pfund-rallye.at",
  "https://1000pfund-rallye.at",
  "http://www.1000pfund-rallye.at",
  "http://1000pfund-rallye.at",
];
const MAX_CHARS = 300;
const VOICE = "fr-FR-DeniseNeural";

const cors = origin => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});
const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) } });
const xml = s => s.replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

async function translate(text, env) {
  // Free-Schlüssel enden auf ":fx" und gehören zu api-free.deepl.com
  const host = env.DEEPL_KEY.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
  const r = await fetch(`https://${host}/v2/translate`, {
    method: "POST",
    headers: { "Authorization": `DeepL-Auth-Key ${env.DEEPL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: [text], source_lang: "DE", target_lang: "FR" }),
  });
  if (!r.ok) throw new Error("deepl " + r.status);
  return (await r.json()).translations[0].text;
}

async function tts(text, slow, env) {
  const ssml = `<speak version="1.0" xml:lang="fr-FR"><voice name="${VOICE}"><prosody rate="${slow ? "-30%" : "0%"}">${xml(text)}</prosody></voice></speak>`;
  const r = await fetch(`https://${env.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.AZURE_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "1000pfund-sprache",
    },
    body: ssml,
  });
  if (!r.ok) throw new Error("azure " + r.status);
  return r.body;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    if (!ORIGINS.includes(origin)) return new Response("Forbidden", { status: 403 });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== "POST") return json({ error: "method" }, 405, origin);

    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    const { success } = await env.LIMITER.limit({ key: ip });
    if (!success) return json({ error: "rate", message: "Zu viele Anfragen. Bitte kurz warten." }, 429, origin);

    let body;
    try { body = await req.json(); } catch (e) { return json({ error: "json" }, 400, origin); }
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return json({ error: "empty" }, 400, origin);
    if (text.length > MAX_CHARS) return json({ error: "long", message: `Höchstens ${MAX_CHARS} Zeichen.` }, 413, origin);

    const path = new URL(req.url).pathname;
    try {
      if (path === "/translate") return json({ fr: await translate(text, env) }, 200, origin);
      if (path === "/tts") {
        return new Response(await tts(text, !!body.slow, env), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", ...cors(origin) } });
      }
      return json({ error: "path" }, 404, origin);
    } catch (e) {
      console.error(e.message);
      return json({ error: "upstream", message: "Der Dienst ist gerade nicht erreichbar." }, 502, origin);
    }
  },
};
