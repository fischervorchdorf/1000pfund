# rallye-wertung (Cloudflare Worker)

Hält den Punktestand der Rallye zentral, damit Laptop und Handy denselben
Stand zeigen. Die Seite selbst liegt auf GitHub Pages und kann nichts
speichern, darum dieser Worker.

## Einmalig einrichten

```bash
cd worker-wertung
npx wrangler login

# 1. Speicher anlegen - gibt eine id aus
npx wrangler kv namespace create WERTUNG

# 2. Diese id in wrangler.toml bei id = "HIER_DIE_ID_EINTRAGEN" eintragen

# 3. Das gemeinsame Passwort setzen (frei wählbar, nur an die Punktezähler geben)
npx wrangler secret put RALLYE_CODE

# 4. Hochladen
npx wrangler deploy
```

`wrangler deploy` gibt die Adresse aus, zum Beispiel
`https://rallye-wertung.DEINNAME.workers.dev`.

Diese Adresse in `sync.js` ganz oben bei `var API = "";` eintragen und pushen.
Danach fragt jede Wertungsseite beim ersten Aufruf nach dem Code und hält
sich von da an selbst auf Stand.

## Schutz

- Nur Aufrufe von 1000pfund-rallye.at (Origin-Prüfung + CORS)
- Jede Anfrage braucht den Rallye-Code, sonst 401
- Nur die acht bekannten Wertungsseiten dürfen speichern
- Höchstens 64 KB pro Seite und 60 Anfragen pro Minute und IP

Der Code liegt nur verschlüsselt bei Cloudflare, nie in dieser Datei,
im HTML oder im Repo.
