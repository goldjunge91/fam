# Cloudflare R2 für Prospekt-Bilder

R2 hostet die Prospekt-Bilder (Cover + Seiten) statt des Bring-CDNs. Die wöchentliche Pipeline lädt die Bilder hoch und ersetzt die CDN-URLs in `brochure_dumps.payload_json` durch R2-URLs. Die App ändert sich nicht — sie lädt weiterhin nur die URLs aus dem Payload.

## 1. Bucket anlegen

1. Cloudflare Dashboard → **R2 Object Storage** → **Create bucket**.
2. Name: `fam-brochures`.
3. Location: **Automatic** (R2 wählt die nächstgelegene Region; für deutsche Nutzer fällt das auf EU).
4. Default Storage Class: **Standard** (Bilder werden wöchentlich neu geladen, Infrequent Access lohnt nicht).
5. Erstellen.

## 2. Öffentlichen Lesezugriff aktivieren

Die App lädt Bilder per HTTPS-URL (`expo-image`), ohne Auth. Dafür gibt es zwei Wege:

**Option A: r2.dev Subdomain (schnell, für Dev/Test)**

1. Bucket → **Settings** → **Public access**.
2. **Allow access** aktivieren.
3. Cloudflare gibt dir eine `*.r2.dev`-URL, z. B. `https://pub-abc123.r2.dev`.

Diese Domain ist nur für Entwicklung gedacht — kein Cache-Control-Header, keine Custom Domain, langsameres CDN.

**Option B: Eigene Domain über Cloudflare (Produktion, empfohlen)**

1. Cloudflare Dashboard → **R2** → dein Bucket → **Settings** → **Custom Domains**.
2. **Connect Domain** → z. B. `brochures.fam.app` (Domain muss in deinem Cloudflare-Konto liegen).
3. Cloudflare richtet DNS und TLS automatisch ein.

Damit bekommst du das volle Cloudflare-CDN, Cache-Control-Header und eine saubere Domain in den Bild-URLs.

## 3. API-Token für die Pipeline erstellen

Die Pipeline (`scripts/seed-brochures.ts`) braucht S3-kompatible Zugangsdaten:

1. Cloudflare Dashboard → **R2** → **Manage R2 API Tokens**.
2. **Create API Token**.
3. Permissions: **Object Read & Write**, eingeschränkt auf Bucket `fam-brochures`.
4. TTL: dauerhaft oder 1 Jahr (wird als GitHub-Secret rotiert).
5. Notieren: **Access Key ID**, **Secret Access Key**, und die **Account ID** (steht im Dashboard rechts oben oder unter R2 → Overview).

Der S3-Endpoint lautet dann:

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com/fam-brochures
```

## 4. GitHub-Repository-Secrets anlegen

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Wert |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare Account ID (32-stellig, hex) |
| `R2_ACCESS_KEY_ID` | Access Key ID aus Schritt 3 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key aus Schritt 3 |
| `R2_BUCKET` | `fam-brochures` |
| `R2_PUBLIC_URL` | Öffentliche Basis-URL, z. B. `https://brochures.fam.app` oder `https://pub-abc123.r2.dev` |

`R2_PUBLIC_URL` ist die Basis, die die Pipeline vor jeden Objektpfad setzt. Beispiel: Payload-URL wird dann `https://brochures.fam.app/brochures/2026-08-28/brn:bring-de:offersbrochure:199326/page-001.jpg`.



## 5. Objektstruktur und Limits

**Objektpfade** (die Pipeline legt sie so an):

```
brochures/<dump-run-datum>/<brochure-id>/<page-number>.jpg
```

Beispiel: `brochures/2026-08-28/brn:bring-de:offersbrochure:199326/001.jpg`

**Größenlimits:**

- Max. Objektgröße: **5 GB pro Objekt** — irrelevant für uns (Bilder sind 50–500 KB).
- Max. Objektanzahl: **unbegrenzt** im Free/Pro-Plan.
- Max. Bucket-Größe: 10 GB im **Free-Plan** ( ausreichend für ~30.000 Bilder à 300 KB), danach kostenpflichtig pro GB-Monat.

**Kosten** (Stand 2026, Free-Tier):

- Storage: erste 10 GB kostenlos.
- Class A Operations (Write/List): erste 1 Mio./Monat kostenlos.
- Class B Operations (Read): erste 10 Mio./Monat kostenlos.
- Egress: **kostenlos** (kein Traffic-Gebühr, der Hauptvorteil gegenüber S3).

Ein typischer wöchentlicher Dump (~1.500 Broschüren à ~35 Seiten = ~52.000 Bilder, ~15 GB) liegt damit knapp über dem Free-Storage-Limit. Rechne mit ~2–3 USD/Monat für Storage, plus ggf. Class-B-Operations (Reads beim App-Laden). Egress bleibt kostenlos.

## 6. Lifecycle-Regeln (alte Dumps aufräumen)

Da jede Woche neue Bilder hochgeladen werden, alte aber nicht mehr referenziert werden, sollte der Bucket regelmäßig geleert werden:

1. Bucket → **Settings** → **Lifecycle rules**.
2. **Add rule**.
3. Prefix: `brochures/`.
4. Condition: Object age > **14 days** (2 Wochen — genug Puffer, falls der neue Dump verspätet läuft und die App noch alte Bilder lädt).
5. Action: **Delete objects**.

Damit bleibt der Bucket auf ~2 Wochen Datenbestand (~30 GB), statt unbegrenzt zu wachsen.

**Hinweis zur Default Multipart Abort Rule:** Cloudflare legt bei jedem Bucket automatisch eine Regel *Abort uploads after 7 day(s)* an. Diese betrifft nur unvollständige Multipart-Uploads (abgebrochene Chunk-Uploads) und keine fertigen Objekte — unverändert lassen.

## 7. Cache-Control-Header

Damit Bilder nicht bei jedem App-Öffnen neu geladen werden, setzt die Pipeline beim Upload `Cache-Control: public, max-age=604800` (7 Tage). Das gilt für alle Objekte im Bucket — da Objektpfade das Dump-Datum enthalten, sind sie immutable und dürfen problemlos gecacht werden.

Cloudflare-CDN (bei Custom Domain) respektiert diesen Header automatisch. Bei `r2.dev` wird er ebenfalls weitergegeben, aber ohne CDN-Caching-Schicht.

## 8. Zusammenfassung: Was du konfigurieren musst

| Schritt | Wert |
|---|---|
| Bucket-Name | `fam-brochures` |
| Location | Automatic |
| Storage Class | Standard |
| Public Access | Allow (r2.dev) oder Custom Domain (Produktion) |
| API-Token | Object Read & Write, nur `fam-brochures` |
| GitHub-Secrets | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` |
| Lifecycle | Prefix `brochures/`, Delete nach 14 Tagen |
| Cache-Control | `public, max-age=604800` (setzt die Pipeline beim Upload) |
