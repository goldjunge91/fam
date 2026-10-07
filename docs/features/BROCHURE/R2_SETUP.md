# Cloudflare R2 für Prospekt-Bilder

R2 hostet die Prospektbilder privat. Der Haupt-Crawler schreibt vollständige Seiten samt Hotspots und privaten R2-Schlüsseln in `canonical_brochures`; `brochure_availability` verknüpft jeden Bild-Cluster mit seinen PLZ. Die App löst Bildschlüssel über die authentifizierte Edge-Function `brochure-image` auf.

## 1. Bucket anlegen

1. Cloudflare Dashboard → **R2 Object Storage** → **Create bucket**.
2. Name: `r2-broschure`.
3. Location: **Automatic** (R2 wählt die nächstgelegene Region; für deutsche Nutzer fällt das auf EU).
4. Default Storage Class: **Standard** (Bilder werden wöchentlich neu geladen, Infrequent Access lohnt nicht).
5. Erstellen. 

## 2. R2 bleibt privat (r2.dev ausgeschaltet)

Der Bucket `r2-broschure` ist **nicht öffentlich** erreichbar — der r2.dev-Endpunkt ist ausgeschaltet (`enabled: false`). Jeder Bildabruf läuft über die Supabase-Edge-Function `brochure-image`, die den Nutzer-JWT prüft und erst danach eine kurzlebige SigV4-Presigned-URL zurückgibt.

**Datenfluss:**

```
Crawler → private R2-Bilder → canonical_brochures + brochure_availability
App → ZIP-gefilterter Katalog → SQLite (Keys statt URLs)
App → GET {supabaseUrl}/functions/v1/brochure-image?key=<key>&Authorization=Bearer <jwt>
Edge Function → JWT prüfen → 302 Redirect zur Presigned-URL
App → GET <presigned-url> → Bild
```

Die Presigned-URL ist standardmäßig 60 Sekunden gültig (`BROCHURE_IMAGE_TTL_SECONDS`). Bild-Traffic läuft direkt zwischen R2 und dem Client — die Edge-Function bleibt im Redirect-Pfad und kostet praktisch keinen Egress.

## 3. API-Token für die Pipeline erstellen

Der Haupt-Crawler (`bun run crawler:brochures`) braucht S3-kompatible Zugangsdaten:

1. Cloudflare Dashboard → **R2** → **Account API tokens**.
2. **Create a token**.
3. Permissions: **Object Read & Write**, eingeschränkt auf Bucket `r2-broschure`.
4. TTL: dauerhaft oder 1 Jahr (wird als GitHub-Secret rotiert).
5. Notieren: **Access Key ID**, **Secret Access Key**, und die **Account ID** (steht im Dashboard rechts oben oder unter R2 → Overview).

```json
{
  "name": "r2-broschure",
  "policies": [
    {
      "effect": "allow",
      "permission_groups": [
        {
          "id": "de21485a24744b76a004aa153898f7fe"
        },
        {
          "id": "714f9c13a5684c2885a793f5edb36f59"
        },
        {
          "id": "0cf6473ad41449e7b7b743d14fc20c60"
        },
        {
          "id": "618ec6c64a3a42f8b08bdcb147ded4e4"
        },
        {
          "id": "b89a480218d04ceb98b4fe57ca29dc1f"
        },
        {
          "id": "2efd5506f9c8494dacb1fa10a3e7d5b6"
        },
        {
          "id": "6a018a9f2fc74eb6b293b0c548f38b39"
        }
      ],
      "resources": {
        "com.cloudflare.edge.r2.bucket.6237d34314fccc45bf5b2522f1660e91_default_r2-broschure": "*"
      }
    }
  ],
  "condition": {},
  "not_before": null,
  "expires_on": null
}
```

```tf
resource "cloudflare_account_token" "example_account_token" {
  account_id = "6237d34314fccc45bf5b2522f1660e91"
  name       = "r2-broschure"

  policies = [{
    effect = "allow"
    permission_groups = [{
      id = "de21485a24744b76a004aa153898f7fe"
      }, {
      id = "714f9c13a5684c2885a793f5edb36f59"
      }, {
      id = "0cf6473ad41449e7b7b743d14fc20c60"
      }, {
      id = "618ec6c64a3a42f8b08bdcb147ded4e4"
      }, {
      id = "b89a480218d04ceb98b4fe57ca29dc1f"
      }, {
      id = "2efd5506f9c8494dacb1fa10a3e7d5b6"
      }, {
      id = "6a018a9f2fc74eb6b293b0c548f38b39"
    }]
    resources = jsonencode({
      "com.cloudflare.edge.r2.bucket.6237d34314fccc45bf5b2522f1660e91_default_r2-broschure" = "*"
    })
  }]
}
```


Der S3-Endpoint lautet dann:

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com/r2-broschure
```

## 4. Secrets

**GitHub Actions (Crawler):**

| Secret | Wert |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare Account ID (32-stellig, hex) |
| `R2_ACCESS_KEY_ID` | Access Key ID aus Schritt 3 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key aus Schritt 3 |
| `R2_BUCKET` | `r2-broschure` |

`R2_PUBLIC_URL` wird nicht benötigt — der Crawler speichert **Objekt-Keys**
(z. B. `brochures/dumps/assets/<sha256-der-quell-url>.jpg`) statt URLs.

**Supabase Edge Function `brochure-image`:**

| Secret | Wert |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | Access Key ID aus Schritt 3 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key aus Schritt 3 |
| `R2_BUCKET` | `r2-broschure` |
| `BROCHURE_IMAGE_TTL_SECONDS` | Optional, default 60 |

Setzen und deployen mit:

```bash
bash scripts/deploy-brochure-image.sh --env .env.development.local
```

Das Script liest die R2-Variablen aus der Env-Datei, setzt sie mit `supabase secrets set` und deployt die Function.



## 5. Objektstruktur und Limits

**Objektpfade** (die Pipeline legt sie so an):

```
brochures/dumps/assets/<sha256-der-quell-url>.jpg
```

Der Katalog führt den getrennten SHA-256 über die Originalbytes von Seite 1 als Bildidentität. Er wird für die Varianten-Gruppierung verwendet und ist nicht der R2-Objektschlüssel.

**Größenlimits:**

- Max. Objektgröße: **5 GB pro Objekt** — irrelevant für uns (Bilder sind 50–500 KB).
- Max. Objektanzahl: **unbegrenzt** im Free/Pro-Plan.
- Max. Bucket-Größe: 10 GB im **Free-Plan** ( ausreichend für ~30.000 Bilder à 300 KB), danach kostenpflichtig pro GB-Monat.

**Kosten** (Stand 2026, Free-Tier):

- Storage: erste 10 GB kostenlos.
- Class A Operations (Write/List): erste 1 Mio./Monat kostenlos.
- Class B Operations (Read): erste 10 Mio./Monat kostenlos.
- Egress: **kostenlos** (kein Traffic-Gebühr, der Hauptvorteil gegenüber S3).

Der Speicherbedarf hängt von den tatsächlich unterschiedlichen Quell-URLs ab. Identische URLs werden innerhalb eines Crawls und über Läufe hinweg nicht erneut hochgeladen.

## 6. Aufbewahrung

Der Crawler löscht keine R2-Objekte und richtet keine Lifecycle-Regel ein.
Die Bildschlüssel leiten sich deterministisch aus den Quell-URLs ab und können
von mehreren Katalogzeilen wiederverwendet werden. Eine zeitbasierte Regel wie
„lösche nach 14 Tagen“ kann daher noch referenzierte Bilder entfernen.

Vor einer Bereinigung müssen die Katalogreferenzen geprüft werden; ein
automatischer Löschlauf ist nicht Teil der Pipeline. `--report-dir` schreibt
einen Speicher- und Aufbewahrungsbericht, verändert aber den Bucket nicht.

**Hinweis zur Default Multipart Abort Rule:** Cloudflare legt bei jedem Bucket automatisch eine Regel *Abort uploads after 7 day(s)* an. Diese betrifft nur unvollständige Multipart-Uploads (abgebrochene Chunk-Uploads) und keine fertigen Objekte — unverändert lassen.

## 7. Cache-Control-Header

Damit Bilder nicht bei jedem App-Öffnen neu geladen werden, setzt die Pipeline
beim Upload `Cache-Control: public, max-age=604800` (7 Tage). Der Bucket bleibt
privat; der Header macht ihn nicht öffentlich. Wenn sich eine Bildversion ändert,
muss die Quell-URL ebenfalls eine neue Version kennzeichnen, damit ein neuer
Objektschlüssel entsteht.

Da der Bucket privat ist, läuft der Abruf über Presigned-URLs. R2 respektiert den Cache-Control-Header auch bei Presigned-GET; `expo-image` cached die Bildbytes zusätzlich lokal auf dem Gerät.

## 8. Zusammenfassung: Was du konfigurieren musst

| Schritt | Wert |
|---|---|
| Bucket-Name | `r2-broschure` |
| Location | Automatic |
| Storage Class | Standard |
| Public Access | **Aus** (Bucket bleibt privat, Abruf via Edge Function) |
| API-Token | Object Read & Write, nur `r2-broschure` |
| GitHub-Secrets (Crawler) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| Supabase-Secrets (Edge Function) | dieselben R2-Variablen + `BROCHURE_IMAGE_TTL_SECONDS` (optional) |
| Lifecycle | Prefix `brochures/`, Aufbewahrung länger als die längste gültige Prospektlaufzeit |
| Cache-Control | `public, max-age=604800` (setzt die Pipeline beim Upload) |
