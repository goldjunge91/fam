// tools/brochure-viewer/server.ts
// Lokaler Showcase-Server für Supermarkt-Prospekte (Bring! API Integration)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const PORT = 3333;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

const DEFAULT_HEADERS = {
  Authorization: `Bearer ${requireEnv("BRING_AUTH_TOKEN").replace(/^Bearer\s+/i, "")}`,
  "X-BRING-API-KEY": requireEnv("BRING_API_KEY"),
  "X-BRING-CLIENT": "iOS",
  "X-BRING-COUNTRY": "DE",
  "X-BRING-VERSION": "4.110.0",
  "X-BRING-USER-UUID": requireEnv("BRING_USER_UUID"),
  "Accept-Language": "de-DE",
  Accept: "application/json",
};

const ZIP_COORDS: Record<string, { lat: number; long: number }> = {
  "22043": { lat: 53.572433, long: 10.09511 },
  "10115": { lat: 52.5323, long: 13.3846 },
  "80331": { lat: 48.1374, long: 11.5755 },
  "50667": { lat: 50.9375, long: 6.9603 },
  "60311": { lat: 50.1109, long: 8.6821 },
  "70173": { lat: 48.7758, long: 9.1829 },
  "01067": { lat: 51.0504, long: 13.7373 },
  "04109": { lat: 51.3397, long: 12.3731 },
  "40213": { lat: 51.2277, long: 6.7735 },
  "90403": { lat: 49.4521, long: 11.0767 },
};

function getCoordsForZip(zip: string) {
  if (ZIP_COORDS[zip]) return ZIP_COORDS[zip];
  return { lat: 53.572433, long: 10.09511 };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url || "/", true);
  const pathname = parsedUrl.pathname || "/";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/api/brochures") {
    const zip = (parsedUrl.query.zip as string) || "22043";
    const coords = getCoordsForZip(zip);
    const apiUrl = `https://production.bringapi.app/offers/rest/v1/offers?type=brochure&providerId=bring-de&lat=${coords.lat}&long=${coords.long}&zipCode=${zip}`;

    try {
      const response = await fetch(apiUrl, { headers: DEFAULT_HEADERS });
      const data = await response.json();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === "/api/brochure-detail") {
    const brn = parsedUrl.query.brn as string;
    const zip = (parsedUrl.query.zip as string) || "22043";
    const coords = getCoordsForZip(zip);

    if (!brn) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing brn query parameter" }));
      return;
    }

    const apiUrl = `https://production.bringapi.app/offers/rest/v1/offers/brochures/${encodeURIComponent(brn)}?brochureId=${encodeURIComponent(brn)}&lat=${coords.lat}&long=${coords.long}&providerId=bring-de&zipCode=${zip}`;

    try {
      const response = await fetch(apiUrl, { headers: DEFAULT_HEADERS });
      const data = await response.json();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. API: Image Proxy (Löst alle CORS-Probleme für Canvas & Bilder im Web)
  if (pathname === "/api/image-proxy") {
    const targetUrl = parsedUrl.query.url as string;
    if (!targetUrl) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing url parameter");
      return;
    }

    try {
      const imgRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      const buffer = await imgRes.arrayBuffer();

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      });
      res.end(Buffer.from(buffer));
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Failed to fetch image: " + err.message);
    }
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    const htmlPath = path.join(__dirname, "index.html");
    if (fs.existsSync(htmlPath)) {
      const content = fs.readFileSync(htmlPath, "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(content);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("index.html not found");
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🛒 Supermarkt-Prospekte Live-Viewer`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
