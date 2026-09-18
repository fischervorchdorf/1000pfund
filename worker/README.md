# sprache-api (Cloudflare Worker)

Übersetzt Deutsch → Französisch (DeepL) und liest Französisch vor (Azure Speech).
Die Seite selbst liegt auf GitHub Pages und kann kein PHP, darum dieser Worker.

## Einmalig einrichten

```bash
cd worker
npx wrangler login
npx wrangler secret put DEEPL_KEY      # DeepL API Free, endet auf :fx
npx wrangler secret put AZURE_KEY      # Azure Speech, Schlüssel 1
npx wrangler secret put AZURE_REGION   # z. B. westeurope
npx wrangler deploy
```

`wrangler deploy` gibt die Adresse aus, z. B. `https://sprache-api.DEINNAME.workers.dev`.
Diese Adresse in `sprache/index.html` bei `const API = "…"` eintragen und pushen.

Die Schlüssel liegen nur verschlüsselt bei Cloudflare – nie in dieser Datei, im HTML oder im Repo.

## Schutz

- Nur Aufrufe von 1000pfund-rallye.at (Origin-Prüfung + CORS)
- Höchstens 300 Zeichen pro Anfrage
- Höchstens 20 Anfragen pro Minute und IP (`wrangler.toml`)
