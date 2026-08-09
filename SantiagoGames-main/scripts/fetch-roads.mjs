#!/usr/bin/env node
/**
 * fetch-roads.mjs
 * ============================================================================
 * Precomputa TODAS las calles OSM ("highway=*") dentro de un radio (por
 * defecto 45 km) desde el centro de Santiago, y las guarda como archivos
 * JSON estáticos particionados en una grilla ("tiles") en:
 *
 *     data/tiles/{tx}_{ty}.json      -- vías cuyo primer nodo cae en ese tile
 *     data/tiles/index.json          -- lista de tiles generados (informativo)
 *     data/meta.json                 -- parámetros usados en esta corrida
 *
 * Esto reemplaza las consultas a Overpass API en tiempo real que hacía la
 * app antes: ahora la app SOLO hace fetch() de estos archivos estáticos
 * (mismo dominio que el resto del sitio, sin límites de tasa ni timeouts
 * de Overpass, sin bloquear la interfaz).
 *
 * IMPORTANTE: correr este script UNA vez, en una máquina con acceso a
 * internet (no dentro del sandbox donde se generó el resto del proyecto,
 * que tiene la red restringida a un allowlist de dominios y no incluye
 * overpass-api.de). Requiere Node 18+ (usa fetch nativo).
 *
 * Uso:
 *   node scripts/fetch-roads.mjs
 *   node scripts/fetch-roads.mjs --radius 45000 --tile-size 2000
 *   node scripts/fetch-roads.mjs --force            (re-descarga todo)
 *   node scripts/fetch-roads.mjs --only -3,5 -2,5    (solo esos tiles, debug)
 *
 * VELOCIDAD: por defecto el script reparte las consultas EN PARALELO entre
 * varios mirrors públicos de Overpass (uno por "worker"), en vez de mandar
 * todo secuencial a un solo servidor. Esto no cambia el resultado final
 * (mismos tiles, mismas calles, mismo dedupe por ownership) — solo lo hace
 * varias veces más rápido, y como cada worker le pega a un mirror distinto,
 * no sobrecarga más a ninguno de ellos individualmente que antes.
 * Se puede ajustar con --endpoints y --concurrency (ver más abajo), o volver
 * al modo secuencial de siempre con --concurrency 1.
 *
 * Se puede cortar (Ctrl+C) y volver a correr en cualquier momento — los
 * tiles ya escritos en disco se saltan automáticamente (salvo --force), así
 * que reintentar los que fallaron es tan simple como correr el comando de
 * nuevo las veces que haga falta.
 * ============================================================================
 */

import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

/* ---------------------------- Configuración ---------------------------- */
const args = process.argv.slice(2);
function argValue(flag, def) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : def;
}
function hasFlag(flag) {
  return args.includes(flag);
}

// DEBEN coincidir con las constantes homónimas en script.js.
const CENTER_LON = parseFloat(argValue("--center-lon", "-70.6506"));
const CENTER_LAT = parseFloat(argValue("--center-lat", "-33.4372"));
const RADIUS_METERS = parseFloat(argValue("--radius", "45000"));
const TILE_SIZE_METERS = parseFloat(argValue("--tile-size", "2000"));
// Margen de la bbox de consulta más allá del propio tile, para no perder
// vías cuyo primer nodo cae justo en el borde entre dos tiles.
const QUERY_BUFFER_METERS = parseFloat(argValue("--buffer", "300"));

// Mirrors públicos conocidos de Overpass. Cada worker en paralelo usa uno
// fijo (round-robin), y si a ese le falla una consulta, reintenta rotando
// al SIGUIENTE mirror de la lista antes de rendirse con ese tile — así un
// solo mirror caído/ocupado no frena todo el proceso.
const DEFAULT_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const ENDPOINTS = (argValue("--endpoints", DEFAULT_ENDPOINTS.join(",")))
  .split(",").map((s) => s.trim()).filter(Boolean);

// Concurrencia = cuántos workers en paralelo. Por defecto, uno por mirror
// disponible (así cada worker le pega a un servidor distinto). Se puede
// forzar con --concurrency, p.ej. --concurrency 1 para volver al modo
// secuencial de antes.
const CONCURRENCY = parseInt(argValue("--concurrency", String(ENDPOINTS.length)), 10);

const REQUEST_DELAY_MS = parseInt(argValue("--delay", "600"), 10); // pausa entre consultas, por worker
const MAX_RETRIES = parseInt(argValue("--retries", "4"), 10);
const MAX_BACKOFF_MS = parseInt(argValue("--max-backoff", "15000"), 10); // techo del backoff
const FORCE = hasFlag("--force");

const OUTPUT_DIR = path.resolve(argValue("--out", "data/tiles"));
const META_PATH = path.resolve(argValue("--meta-out", "data/meta.json"));

const onlyArg = argValue("--only", null);
const onlyTiles = onlyArg
  ? args.slice(args.indexOf("--only") + 1).filter((s) => /^-?\d+,-?\d+$/.test(s))
  : null;

/* --------------------- Proyección local (igual que el cliente) --------------------- */
const METERS_PER_DEG_LAT = 111320;
function metersPerDegLon(atLatDeg) {
  return 111320 * Math.cos((atLatDeg * Math.PI) / 180);
}
function lonLatToLocalXY(lon, lat) {
  return {
    x: (lon - CENTER_LON) * metersPerDegLon(CENTER_LAT),
    y: (lat - CENTER_LAT) * METERS_PER_DEG_LAT,
  };
}
function localXYToLonLat(x, y) {
  return {
    lon: CENTER_LON + x / metersPerDegLon(CENTER_LAT),
    lat: CENTER_LAT + y / METERS_PER_DEG_LAT,
  };
}
function tileCoordsForXY(x, y) {
  return { tx: Math.floor(x / TILE_SIZE_METERS), ty: Math.floor(y / TILE_SIZE_METERS) };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ------------------------------ Overpass -------------------------------- */
async function queryOverpass(bboxSouth, bboxWest, bboxNorth, bboxEast, preferredEndpointIndex, log) {
  const query = `
    [out:json][timeout:180];
    way["highway"](${bboxSouth},${bboxWest},${bboxNorth},${bboxEast});
    (._;>;);
    out body;
  `;

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Rota de mirror en cada reintento (empezando por el preferido de este
    // worker), para que un solo servidor caído/ocupado no frene el tile.
    const endpoint = ENDPOINTS[(preferredEndpointIndex + attempt - 1) % ENDPOINTS.length];

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          // El método oficial documentado por Overpass es enviar la
          // consulta como el campo "data" de un body urlencoded, con un
          // User-Agent identificable y un Accept explícito. Sin esto,
          // algunos entornos (p.ej. Node/fetch en Termux, sin User-Agent
          // por defecto) reciben 406 Not Acceptable del servidor.
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json, */*;q=0.8",
          "User-Agent": "SantiagoGames-fetch-roads/1.0 (+https://github.com/; script de precomputo de calles, uso personal)",
        },
        body: "data=" + encodeURIComponent(query),
      });

      if (response.status === 429 || response.status === 504) {
        const backoff = Math.min(REQUEST_DELAY_MS * attempt * 3, MAX_BACKOFF_MS);
        log(`${endpoint.split("/")[2]} ${response.status} (ocupado) — reintento ${attempt}/${MAX_RETRIES} en ${backoff}ms (rotando de mirror)…`);
        lastError = new Error(`Overpass ${response.status}`);
        await sleep(backoff);
        continue;
      }
      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        throw new Error(`${endpoint.split("/")[2]} respondió ${response.status}${bodyText ? ` — ${bodyText.slice(0, 150)}` : ""}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
      const backoff = Math.min(REQUEST_DELAY_MS * attempt * 2, MAX_BACKOFF_MS);
      log(`Error (${error.message}) — reintento ${attempt}/${MAX_RETRIES} en ${backoff}ms (rotando de mirror)…`);
      await sleep(backoff);
    }
  }
  throw lastError ?? new Error("Se agotaron los reintentos contra Overpass.");
}

function parseWays(osmJson) {
  const nodeById = new Map();
  for (const el of osmJson.elements) {
    if (el.type === "node") nodeById.set(el.id, { lon: el.lon, lat: el.lat });
  }

  const ways = [];
  for (const el of osmJson.elements) {
    if (el.type !== "way" || !el.tags || !el.tags.highway) continue;
    const coordinates = el.nodes.map((id) => nodeById.get(id)).filter(Boolean);
    if (coordinates.length < 2) continue;
    ways.push({
      id: el.id,
      highwayType: el.tags.highway,
      name: el.tags.name || null,
      coordinates: coordinates.map((c) => [round6(c.lon), round6(c.lat)]),
    });
  }
  return ways;
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/* -------------------------------- Main ----------------------------------- */
async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Calcula el rango de tiles que cubre el círculo de RADIUS_METERS.
  const minTile = tileCoordsForXY(-RADIUS_METERS, -RADIUS_METERS);
  const maxTile = tileCoordsForXY(RADIUS_METERS, RADIUS_METERS);

  const tileList = [];
  for (let tx = minTile.tx; tx <= maxTile.tx; tx++) {
    for (let ty = minTile.ty; ty <= maxTile.ty; ty++) {
      const cx = tx * TILE_SIZE_METERS + TILE_SIZE_METERS / 2;
      const cy = ty * TILE_SIZE_METERS + TILE_SIZE_METERS / 2;
      // Descarta tiles cuyo centro esté claramente fuera del círculo del
      // mundo (con margen de media diagonal de tile), para no gastar
      // consultas en las esquinas del cuadrado que rodea el círculo.
      const halfDiag = (TILE_SIZE_METERS * Math.SQRT2) / 2;
      if (Math.hypot(cx, cy) - halfDiag > RADIUS_METERS) continue;
      tileList.push({ tx, ty });
    }
  }

  const allCandidates = onlyTiles
    ? tileList.filter((t) => onlyTiles.includes(`${t.tx},${t.ty}`))
    : tileList;

  console.log(`Centro: ${CENTER_LAT}, ${CENTER_LON} | Radio: ${RADIUS_METERS} m | Tile: ${TILE_SIZE_METERS} m`);
  console.log(`Tiles en el círculo: ${allCandidates.length}`);
  console.log(`Mirrors: ${ENDPOINTS.join(", ")}`);
  console.log(`Concurrencia: ${CONCURRENCY} worker(s) en paralelo`);
  console.log(`Salida: ${OUTPUT_DIR}`);
  console.log("");

  // Filtra de entrada los que ya existen (a menos que --force), así el
  // contador de progreso y la cola solo reflejan trabajo real por hacer.
  const pending = [];
  let skipped = 0;
  const generatedTiles = [];

  for (const t of allCandidates) {
    const tileKey = `${t.tx}_${t.ty}`;
    if (!FORCE) {
      try {
        await stat(path.join(OUTPUT_DIR, `${tileKey}.json`));
        generatedTiles.push(tileKey);
        skipped++;
        continue;
      } catch {
        /* no existe, va a la cola */
      }
    }
    pending.push(t);
  }

  console.log(`Ya generados (se saltan): ${skipped}`);
  console.log(`Pendientes esta corrida: ${pending.length}`);
  console.log("");

  let totalWays = 0;
  let doneCount = 0;
  let failedCount = 0;
  const failedTiles = [];
  const total = pending.length;

  async function worker(workerIndex) {
    const preferredEndpointIndex = workerIndex % ENDPOINTS.length;

    while (pending.length > 0) {
      const t = pending.shift(); // síncrono, sin race entre workers
      if (!t) break;
      const { tx, ty } = t;
      const tileKey = `${tx}_${ty}`;
      const label = `[w${workerIndex}]`;

      const log = (msg) => console.log(`  ${label} ${tileKey}: ${msg}`);

      const west = tx * TILE_SIZE_METERS - QUERY_BUFFER_METERS;
      const east = (tx + 1) * TILE_SIZE_METERS + QUERY_BUFFER_METERS;
      const south = ty * TILE_SIZE_METERS - QUERY_BUFFER_METERS;
      const north = (ty + 1) * TILE_SIZE_METERS + QUERY_BUFFER_METERS;
      const swLL = localXYToLonLat(west, south);
      const neLL = localXYToLonLat(east, north);

      try {
        const osmJson = await queryOverpass(swLL.lat, swLL.lon, neLL.lat, neLL.lon, preferredEndpointIndex, log);
        const allWays = parseWays(osmJson);

        // Ownership: solo se guardan en ESTE tile las vías cuyo PRIMER nodo
        // cae exactamente dentro de sus límites — así cada vía queda en un
        // único archivo en todo el dataset, sin coordinar entre workers.
        const owned = allWays.filter((way) => {
          const [lon, lat] = way.coordinates[0];
          const { x, y } = lonLatToLocalXY(lon, lat);
          const owner = tileCoordsForXY(x, y);
          return owner.tx === tx && owner.ty === ty;
        });

        if (owned.length > 0) {
          await writeFile(path.join(OUTPUT_DIR, `${tileKey}.json`), JSON.stringify(owned));
          generatedTiles.push(tileKey);
          totalWays += owned.length;
        }

        doneCount++;
        console.log(`${label} [${doneCount}/${total}] ${tileKey} → ${owned.length > 0 ? `${owned.length} vías` : "sin vías"}`);
      } catch (error) {
        doneCount++;
        failedCount++;
        failedTiles.push(tileKey);
        console.error(`${label} [${doneCount}/${total}] ${tileKey} → ERROR, se salta: ${error.message}`);
      }

      if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
    }
  }

  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, (_, i) => worker(i));
  await Promise.all(workers);

  await writeFile(
    path.join(OUTPUT_DIR, "index.json"),
    JSON.stringify({ tiles: generatedTiles }, null, 2)
  );
  await writeFile(
    META_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        centerLon: CENTER_LON,
        centerLat: CENTER_LAT,
        radiusMeters: RADIUS_METERS,
        tileSizeMeters: TILE_SIZE_METERS,
        totalTiles: generatedTiles.length,
        totalWays,
      },
      null,
      2
    )
  );

  console.log("");
  console.log(`Listo. ${generatedTiles.length} tiles con datos (${skipped} ya existían de antes), ${totalWays} vías nuevas escritas.`);
  if (failedCount > 0) {
    console.log(`${failedCount} tiles fallaron y quedaron pendientes: ${failedTiles.join(", ")}`);
    console.log(`Corré el mismo comando de nuevo (las veces que haga falta) para reintentar SOLO esos — los que ya están listos se saltan.`);
  }
  console.log(`No olvides pushear la carpeta ${path.relative(process.cwd(), OUTPUT_DIR)}/ junto con el resto del proyecto.`);
}

main().catch((error) => {
  console.error("Fallo fatal:", error);
  process.exit(1);
});
