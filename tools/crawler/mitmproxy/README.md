# Bring! Token Capture mit mitmproxy (SSL/HTTPS)

Automatisches Abfangen und Speichern von Bring!-API-Schlüsseln über einen Man-in-the-Middle-Proxy mit voller SSL-Unterstützung.

Sobald der Proxy läuft und das Smartphone/der Simulator mit dem Proxy verbunden ist, fängt das Skript jeden Bring!-Request ab und speichert die Keys automatisch in:
- `tokens_backup.env` (im Projekt-Root)
- `tools/crawler/.env`

---

## 🚀 Schnellstart

Aus dem Projekt-Root ausführen:

```powershell
bun run capture:bring
```

*Hinweis: Port 8080 ist der Proxy, Port 8082 die Web-Oberfläche (`http://127.0.0.1:8082`). Port 8081 bleibt für den Metro-Bundler frei.*

---

## 📱 Einmalige Einrichtung auf dem Smartphone

Damit HTTPS-Verkehr entschlüsselt werden kann, muss das vom Proxy generierte Root-Zertifikat auf dem Endgerät installiert sein:

### 1. Proxy im WLAN einstellen
1. Auf deinem Smartphone in die **WLAN-Einstellungen** gehen.
2. Das verbundene WLAN antippen und den **HTTP-Proxy** auf **Manuell** stellen:
   - **Server / Host:** Die LAN-IP deines PCs (wird vom Startskript angezeigt, z.B. `192.168.178.50`)
   - **Port:** `8080`

### 2. SSL-Zertifikat herunterladen
1. Auf dem Smartphone den Browser öffnen (z. B. **Safari** auf iOS oder Chrome).
2. Die Adresse aufrufen:
   ```text
   http://mitm.it
   ```
3. Das passende Betriebssystem auswählen (**Apple** bzw. **Android**) und das Profil herunterladen.

### 3. Zertifikat aktivieren / Vertrauen einrichten

#### Für iOS (iPhone / iPad / Simulator):
1. **Einstellungen > Profil geladen** öffnen und auf **Installieren** tippen.
2. Anschließend zu:
   **Einstellungen > Allgemein > Info > Zertifikatsvertrauenseinstellungen**
   *(Certificate Trust Settings)* navigieren.
3. Unter *Volles Vertrauen für Root-Zertifikate aktivieren* den Schalter für **`mitmproxy`** auf **EIN** stellen.

#### Für Android:
1. Das heruntergeladene Zertifikat unter **Einstellungen > Sicherheit > Verschlüsselung & Anmeldedaten > Zertifikat installieren > CA-Zertifikat** auswählen und bestätigen.

---

## 🔑 Tokens erfassen

1. Öffne die **Bring!-App** auf dem Smartphone.
2. Sobald die App Inhalte lädt oder du dich anmeldest, erscheint im Terminal:
   ```text
   ============================================================
   [Bring-Capture] NEUE / AKTUALISIERTE KEYS ERFASST!
   ============================================================
     [+] BRING_AUTH_TOKEN: eyJhbGciOi...
         Token-Ablaufdatum: 2026-10-15 14:30:00 CEST
     [+] BRING_API_KEY:    ...
     [+] BRING_USER_UUID:  ...
     [>] Gespeichert in:
        - C:\GIT\fam\tokens_backup.env
        - C:\GIT\fam\tools\crawler\.env
   ============================================================
   ```
3. Den Proxy mit `Strg + C` beenden.
4. Der Crawler kann nun direkt mit echten Daten gestartet werden:
   ```powershell
   bun run crawler:brochures --plz=22043 --dry-run
   ```
