/* ==========================================================================
   SantiagoGames — selector de juegos + simulación CesiumJS
   La simulación NUNCA se ejecuta sola al cargar la página: solo se
   inicializa la primera vez que el usuario presiona "Seleccionar".
   ========================================================================== */

const GAMES = [
  { name:"GTA en Santiago", author:"@Vycaiem", desc:"Mundo abierto ambientado en la ciudad de Santiago, al estilo GTA clásico." },
  { name:"Hikikomori en Santiago", author:"@Infinite-Path-3436", desc:"Narrativa sobre la vida de un hikikomori en los ghettos/departamentos de la ciudad." },
  { name:"Autopistas de Santiago", author:"@FuturoComplejo", desc:"Carreras estilo Need for Speed: Most Wanted usando autopistas y caminos enredados." },
  { name:"Taxi Loco Santiago", author:"@Garrek999", desc:"Juego de conducción arcade estilo Crazy Taxi por las calles de la capital." },
  { name:"Delincuencia Local", author:"@Santox75", desc:"GTA enfocado en delincuencia local: lanzas, mecheros, turbazos y más." },
  { name:"GTA III Santiago", author:"@DotAtom67", desc:"Reinterpretación de GTA 3 ambientada completamente en Santiago." },
  { name:"Santiago para Unreal", author:"@LaTiaCandeloro", desc:"Modelado 3D de la ciudad para Unreal Engine, pensado como asset comercial." },
  { name:"Sandbox Cotidiano", author:"@Competitive-Silver98", desc:"Sandbox tipo GTA con misiones cotidianas: ir a la feria, comprar para la once, y más." },
  { name:"Clon GTA / Yakuza", author:"@Alkeindem", desc:"Mundo abierto de acción inspirado en GTA y Yakuza." },
  { name:"Clon Resident Evil / L4D", author:"@Alkeindem", desc:"Survival horror cooperativo inspirado en Resident Evil y Left 4 Dead." },
  { name:"Clon SimCity", author:"@Alkeindem", desc:"Simulador de construcción y gestión urbana al estilo SimCity." },
  { name:"Clon Spider-Man / Prototype", author:"@Alkeindem", desc:"Mundo abierto con superpoderes, mezcla de Spider-Man y Prototype." },
  { name:"Clon Metro", author:"@Alkeindem", desc:"Aventura narrativa de mundo semiabierto inspirada en la saga Metro." },
  { name:"Uber Simulator", author:"@Alkeindem", desc:"Simulador de conducción y viajes tipo Uber por la ciudad." },
];

/* ========================= PANTALLA 1: SELECTOR ========================= */

const selectorScreen = document.getElementById("selectorScreen");
const simScreen = document.getElementById("simScreen");

const wheel = document.getElementById("wheel");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const selectBtn = document.getElementById("selectBtn");

const detailIndex = document.getElementById("detailIndex");
const detailTitle = document.getElementById("detailTitle");
const detailAuthor = document.getElementById("detailAuthor");
const detailDesc = document.getElementById("detailDesc");

let current = 0;
const cardEls = [];

function buildCards(){
  GAMES.forEach((game, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card__index">${String(i+1).padStart(2,"0")}</div>
      <div class="card__name">${game.name}</div>
      <div class="card__author">${game.author}</div>
    `;
    card.addEventListener("click", () => {
      if (i === current) return;
      current = i;
      render();
    });
    wheel.appendChild(card);
    cardEls.push(card);
  });
}

function layout(){
  const spacing = window.innerWidth < 640 ? 130 : 190;
  const maxVisible = 3;

  cardEls.forEach((card, i) => {
    let offset = i - current;
    const total = GAMES.length;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;

    const abs = Math.abs(offset);

    if (abs > maxVisible){
      card.style.opacity = "0";
      card.style.pointerEvents = "none";
      card.style.transform = `translate(-50%,-50%) translateX(${offset * spacing}px) scale(0.7)`;
      return;
    }

    const scale = 1 - abs * 0.16;
    const y = abs * 14;
    const rotate = offset * 6;
    const opacity = 1 - abs * 0.26;

    card.style.opacity = String(Math.max(opacity, 0));
    card.style.pointerEvents = "auto";
    card.style.zIndex = String(10 - abs);
    card.style.transform =
      `translate(-50%,-50%) translateX(${offset * spacing}px) translateY(${y}px) scale(${scale}) rotate(${rotate}deg)`;

    card.classList.toggle("is-active", offset === 0);
  });
}

function renderDetail(){
  const game = GAMES[current];
  detailIndex.textContent = `${String(current+1).padStart(2,"0")} / ${String(GAMES.length).padStart(2,"0")}`;
  detailTitle.textContent = game.name;
  detailAuthor.textContent = game.author;
  detailDesc.textContent = game.desc;
}

function render(){
  layout();
  renderDetail();
}

function step(dir){
  current = (current + dir + GAMES.length) % GAMES.length;
  render();
}

prevBtn.addEventListener("click", () => step(-1));
nextBtn.addEventListener("click", () => step(1));
window.addEventListener("resize", layout);

document.addEventListener("keydown", (e) => {
  if (selectorScreen.hidden) return; // no navegar la rueda si estamos en la simulación
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
});

/* ===================== PANTALLA 2: SIMULACIÓN CESIUM ===================== */

Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3YjBhYjU1Ny0zZTk3LTQzNTMtOWZkMC0xYjY3MzM0YWIzOWQiLCJpZCI6NDQ2NzA0LCJzdWIiOiJyZW5hdHByb3h4MTMiLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoiR0QiLCJpYXQiOjE3ODQ4NTQ3MDZ9.bnKu2GliHFuowDLX06il4W3DsGhdPoflNV2BsvWcjxw";

const CENTER_LON = -70.6506;
const CENTER_LAT = -33.4372;
// Radio máximo del mundo/mapa: 45 km desde el centro de Santiago. Esto solo
// define el límite del recorte de 3D Tiles (hasta dónde existe "mundo");
// NO implica descargar/generar calles de todo ese radio de una vez — eso lo
// resuelve el streaming dinámico de calles (ver ROAD_WORLD_RADIUS_METERS).
const RADIUS_METERS = 45000; // 45 km

/* ============ SPAWN POR DEFECTO: 1988 Audi Quattro ============
   Punto de aparición fijo para CUALQUIER juego seleccionado en el
   selector. El heading está fijado a 332.5° (centro del rango
   330–335°, nor-noroeste).
   NOTA: el modelo real del repo (1988AudiQuattro.car / .mesh) está en
   formato OGRE (Rigs of Rods) y no es compatible con CesiumJS, que
   requiere glTF/glb. Mientras no exista una versión .glb del Audi,
   se usa un modelo placeholder en models/1988_audi_quattro.glb —
   basta con reemplazar ese archivo por el Audi convertido a glb para
   que aparezca el modelo real, sin tocar el resto del código. */
const SPAWN_LON = -70.7039520;
const SPAWN_LAT = -33.4721851;
const SPAWN_HEADING_DEG = 332.5; // NNO, dentro de 330–335°
const AUDI_MODEL_URL = "models/1988_audi_quattro.glb";
let audiEntity = null;

/* ============ TRAMO VIAL (archivo local precomputado + elevación real) ===
   Pipeline, en orden:
   1) Datos viales: YA NO se consulta Overpass API en tiempo de ejecución.
      Todas las vías ("highway=*") de los 45 km de mundo se descargan UNA
      sola vez, offline, con scripts/fetch-roads.mjs, y quedan guardadas
      como archivos JSON estáticos en data/tiles/ (uno por celda de 1 km).
      En runtime, el streaming solo hace fetch() de esos archivos locales.
   2) Modelado de terreno y elevación: cada nodo de cada vía se cruza con
      la altimetría real de los 3D Tiles vía scene.sampleHeightMostDetailed
      (esto sí es en vivo — no se puede precomputar sin levantar Cesium).
   3) Generación procedimental al vuelo: con esas alturas se arma una malla
      de "corridor" (cinta 3D con ancho según tipo de vía) por cada calle,
      construida en el cliente bajo demanda, a medida que el auto se mueve. */

// El "mundo" sigue teniendo hasta 45 km de radio desde el centro de
// Santiago (mismo centro que el recorte de 3D Tiles), pero eso NO
// significa que se descarguen/generen las calles de todo ese radio de
// una sola vez en el navegador. El archivo local (data/tiles/) SÍ cubre
// los 45 km completos (se generó una sola vez, offline), pero el cliente
// solo va pidiendo/renderizando de a un área de streaming por vez.
//
// STREAMING DINÁMICO POR CHUNKS.
//   - El mapa/mundo sigue limitado a ROAD_WORLD_RADIUS_METERS (45 km):
//     nunca se pide/genera nada más allá de ese radio desde el centro.
//   - Alrededor del auto solo se mantiene cargado un área de
//     ROAD_LOAD_RADIUS_METERS (300 m).
//   - Se usa histéresis: un chunk se descarga recién cuando queda a más
//     de ROAD_UNLOAD_RADIUS_METERS (400-450 m) del auto, para no estar
//     generando/eliminando constantemente cuando el auto ronda el borde.
const ROAD_WORLD_RADIUS_METERS = 45000;   // límite máximo del mundo/mapa
const ROAD_LOAD_RADIUS_METERS = 300;      // radio de generación activa alrededor del auto
const ROAD_UNLOAD_RADIUS_METERS = 425;    // histéresis: se descarga más allá de esto
const ROAD_CHUNK_SIZE_METERS = 150;       // tamaño de celda de la grilla de streaming
const ROAD_STREAM_MOVE_THRESHOLD = 25;    // metros que debe moverse el auto para reevaluar
const ROAD_STREAM_CHECK_INTERVAL_MS = 350; // cada cuánto se revisa la posición del auto
const ROAD_SAMPLE_BATCH = 60;   // nodos por tanda en sampleHeightMostDetailed
const ROAD_SURFACE_OFFSET = 0.15; // metros sobre el terreno, evita z-fighting
const ROAD_MAX_CHUNK_LOADS_PER_TICK = 1; // cuántos chunks se procesan por pasada de la cola

// Ancho aproximado (m) por tipo de vía OSM.
const ROAD_WIDTH_BY_TYPE = {
  motorway: 12, trunk: 11, primary: 10, secondary: 9, tertiary: 8,
  unclassified: 7, residential: 7, service: 4.5, living_street: 6,
  pedestrian: 4, footway: 2, cycleway: 2.5, track: 4, path: 2,
};
const ROAD_WIDTH_DEFAULT = 6;

/* ---- Estado del sistema de streaming de calles (chunks alrededor del auto) ----
   roadChunks         : Map(chunkKey -> { cx, cy, centerLon, centerLat, status,
                                           entities:[], wayIds:Set }) — chunks
                         actualmente registrados (cargados, cargando o en cola).
   roadChunkDataCache  : Map(chunkKey -> roadsWithHeights[]) — caché en memoria
                         de las vías YA elevadas, sobrevive al descargar el
                         chunk, para no volver a muestrear elevación si el
                         auto regresa a esa zona.
   roadEntityByWay     : Map(wayId -> entity) — reutilización/eliminación de
                         la geometría ya generada para esa vía.
   roadLoadQueue       : chunkKeys pendientes de generar, en orden de cercanía
                         al auto.
   roadQueueSet        : Set espejo de roadLoadQueue, para evitar encolar el
                         mismo chunk dos veces.
*/
let roadChunks = new Map();
let roadChunkDataCache = new Map();
let roadEntityByWay = new Map();
let roadLoadQueue = [];
let roadQueueSet = new Set();
let isProcessingRoadQueue = false;
let roadStreamingActive = false;
let roadStreamTimerId = null;
let lastStreamCarX = null;
let lastStreamCarY = null;
let roadStreamStats = { loaded: 0, queued: 0 };

// Mantenido por compatibilidad con el resto del código (p.ej. limpieza total).
let roadEntities = [];

function yieldToMain(){
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/* ---- Proyección local plano-tangente (ENU aprox.) centrada en CENTER_LON/LAT.
   Válida para las distancias que maneja el streaming (cientos de metros a
   pocos km), evita tener que hacer trigonometría esférica completa en cada
   chequeo de distancia. */
const _metersPerDegLat = 111320;
function _metersPerDegLon(atLatDeg){
  return 111320 * Math.cos(Cesium.Math.toRadians(atLatDeg));
}

function lonLatToLocalXY(lon, lat){
  const x = (lon - CENTER_LON) * _metersPerDegLon(CENTER_LAT);
  const y = (lat - CENTER_LAT) * _metersPerDegLat;
  return { x, y };
}

function localXYToLonLat(x, y){
  const lon = CENTER_LON + x / _metersPerDegLon(CENTER_LAT);
  const lat = CENTER_LAT + y / _metersPerDegLat;
  return { lon, lat };
}

function chunkCoordsForLonLat(lon, lat){
  const { x, y } = lonLatToLocalXY(lon, lat);
  return {
    cx: Math.floor(x / ROAD_CHUNK_SIZE_METERS),
    cy: Math.floor(y / ROAD_CHUNK_SIZE_METERS),
  };
}

function chunkKeyFor(cx, cy){
  return `${cx}_${cy}`;
}

function chunkCenterLonLat(cx, cy){
  const x = cx * ROAD_CHUNK_SIZE_METERS + ROAD_CHUNK_SIZE_METERS / 2;
  const y = cy * ROAD_CHUNK_SIZE_METERS + ROAD_CHUNK_SIZE_METERS / 2;
  return localXYToLonLat(x, y);
}

const hudTitle = document.getElementById("hudTitle");
const hudStatus = document.getElementById("hudStatus");
const backBtn = document.getElementById("backBtn");

/* ---------------------- Pantalla de carga (UI) ---------------------- */

const loadingOverlay = document.getElementById("loadingOverlay");
const loadingDetail = document.getElementById("loadingDetail");
const LOADING_STEP_IDS = ["stepTiles", "stepOsm", "stepElevation", "stepMesh", "stepSpawn"];

function setLoadingStep(stepId, state, detailText){
  LOADING_STEP_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === stepId){
      el.classList.remove("is-active", "is-done", "is-error");
      el.classList.add(state === "error" ? "is-error" : state === "done" ? "is-done" : "is-active");
      const mark = el.querySelector(".loading-step__mark");
      if (mark) mark.textContent = state === "error" ? "×" : state === "done" ? "●" : "○";
    }
  });
  if (detailText) loadingDetail.textContent = detailText;
}

function markStepDone(stepId, detailText){
  setLoadingStep(stepId, "done", detailText);
}

function showLoadingOverlay(){
  loadingOverlay.classList.remove("is-hidden");
  loadingOverlay.hidden = false;
}

function hideLoadingOverlay(){
  loadingOverlay.classList.add("is-hidden");
  setTimeout(() => { loadingOverlay.hidden = true; }, 350);
}

let viewer = null;
let simInitialized = false;
let tileset = null; // referencia global al 3D Tileset, usada por el panel de Configuración

/* ============ CONFIGURACIÓN / OPTIMIZACIÓN (heredado de GeoDrive) ============
   Mismos mecanismos que usa GeoDrive para su sistema de calidad/rendimiento
   de Google Photorealistic 3D Tiles (maximumScreenSpaceError, culling del
   frustum, depth test contra terreno, distancia de renderizado, manejo de
   memoria de tiles, etc). Aquí se centralizan en un único objeto y un único
   menú, en vez de repartirse en varias pestañas como en GeoDrive. */
const gdSettings = {
  screenSpaceError: 16,     // GeoDrive: maximumScreenSpaceError (preset "Normal")
  occlusionCulling: true,   // GeoDrive: cullWithChildrenBounds + skipLevelOfDetail + grid trim
  depthAgainstTerrain: true,// GeoDrive: scene.globe.depthTestAgainstTerrain
  renderDistance: 60000,    // GeoDrive: gp3dtRenderDistance (metros) — alto por
                             // defecto para no ocultar el tileset durante la
                             // vista panorámica inicial (cámara a 60 km de altura)
};

// Optimizaciones automáticas de GeoDrive que permanecen SIEMPRE activas,
// sin exponerse en la UI (el usuario no necesita tocarlas manualmente).
const GD_AUTO_OPTIMIZATIONS = {
  dynamicScreenSpaceError: true,
  dynamicScreenSpaceErrorDensity: 0.00278,
  skipLevelOfDetail: true,
  baseScreenSpaceError: 1024,
  skipScreenSpaceErrorFactor: 16,
  skipLevels: 1,
  preferLeaves: false,
  progressiveResolutionHeightFraction: 0.3,
  maximumMemoryUsage: 2048, // MB — techo de caché de tiles fuera de vista
};

let _gdDistanceIsFar = null; // evita recalcular show/hide en cada frame si no cambió
let _gdGridTrimHandler = null;

function buildCirclePositions(lon, lat, radiusMeters, segments = 128) {
  const positions = [];
  for (let i = 0; i < segments; i++) {
    const bearing = (i / segments) * Cesium.Math.TWO_PI;
    const [lonRad, latRad] = destinationPointRadians(
      Cesium.Math.toRadians(lon),
      Cesium.Math.toRadians(lat),
      bearing,
      radiusMeters
    );
    positions.push(Cesium.Cartesian3.fromRadians(lonRad, latRad));
  }
  return positions;
}

function destinationPointRadians(lonRad, latRad, bearingRad, distanceMeters) {
  const EARTH_RADIUS = 6378137.0;
  const angularDistance = distanceMeters / EARTH_RADIUS;

  const lat2 = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const lon2 =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2)
    );

  return [lon2, lat2];
}

async function initSimulation(gameName){
  hudTitle.textContent = gameName ? gameName.toUpperCase() : "SANTIAGOGAMES";

  if (simInitialized){
    // Ya está montado, no se vuelve a inicializar Cesium — solo se
    // reactiva el streaming de calles (se había detenido al volver al
    // selector) para que siga siguiendo al auto automáticamente.
    lastStreamCarX = null;
    lastStreamCarY = null;
    startRoadStreaming();
    updateHudStreamingStatus();
    return;
  }
  simInitialized = true;

  showLoadingOverlay();

  viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    globe: false,
  });

  viewer.scene.skyAtmosphere.show = false;
  viewer.scene.fog.enabled = false;
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#121210");

  try {
    setLoadingStep("stepTiles", "active", "Descargando 3D Tiles fotorrealistas…");
    tileset = await Cesium.createGooglePhotorealistic3DTileset();
    viewer.scene.primitives.add(tileset);

    const circlePositions = buildCirclePositions(CENTER_LON, CENTER_LAT, RADIUS_METERS);
    const clippingPolygon = new Cesium.ClippingPolygon({ positions: circlePositions });

    tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({
      polygons: [clippingPolygon],
      // inverse: true => se conserva lo de DENTRO del polígono (el círculo de 45 km)
      inverse: true,
    });

    // Aplica el sistema de optimización de GeoDrive (SSE, culling, distancia,
    // memoria, LOD) apenas el tileset está listo.
    applyGdOptimizations();
    startGdRenderDistanceWatcher();
    markStepDone("stepTiles", "3D Tiles listos.");

    hudStatus.textContent = "3D Tiles cargados — ubicando Audi Quattro…";
    await spawnAudiQuattro();

    // Streaming de calles: solo se genera el parche inicial (300 m
    // alrededor del spawn) antes de ocultar la pantalla de carga. El resto
    // del mundo (hasta 45 km) se va generando dinámicamente a medida que
    // el auto se mueve, sin bloquear la interfaz.
    hudStatus.textContent = "Generando calles cercanas al spawn…";
    await generateInitialRoadPatch(SPAWN_LON, SPAWN_LAT);

    updateHudStreamingStatus();
    hideLoadingOverlay();
  } catch (error) {
    console.error(error);
    hudStatus.textContent = "Error al cargar los 3D Tiles (ver consola)";
    setLoadingStep("stepTiles", "error", "Error — revisa la consola.");
  }
}

/* ===================== PASO 1: Consumo de datos OSM ===================== */

/**
 * ======================================================================
 * FUENTE DE DATOS VIALES: ARCHIVO PRECOMPUTADO POR TILES (ya NO Overpass
 * en tiempo real).
 * ======================================================================
 *
 * Antes, cada chunk de streaming (150 m) golpeaba la API de Overpass en
 * el momento en que el auto se acercaba — eso es lo que causaba las
 * esperas erráticas / cuelgues. Ahora TODAS las calles dentro de los
 * 45 km del mundo se descargan UNA sola vez, offline, con el script
 * `scripts/fetch-roads.mjs` (ver ese archivo e INSTRUCCIONES.md), y
 * quedan guardadas como archivos estáticos JSON en `data/tiles/`,
 * particionados en una grilla de ROAD_TILE_SIZE_METERS (2 km) por lado.
 * Este valor DEBE coincidir con --tile-size en scripts/fetch-roads.mjs
 * (mismo default: 2000 m) — si cambiás uno, cambiá el otro.
 *
 * En tiempo de ejecución, el streaming de 300 m alrededor del auto NO
 * llama a ninguna API externa: solo hace fetch() de esos archivos
 * estáticos locales (mismo dominio, sin límites de tasa, sin timeouts de
 * Overpass, sin bloqueos). Cada tile trae ~4 km² de calles ya
 * resueltas (id, tipo, nombre, coordenadas), y de ahí el streaming solo
 * agrupa/filtra en memoria por chunk de 150 m — muy barato.
 *
 * La única llamada de red que sigue ocurriendo por chunk es el muestreo
 * de ELEVACIÓN real (Cesium sampleHeightMostDetailed contra los 3D
 * Tiles), porque la altura del terreno no se puede precomputar sin
 * levantar Cesium — pero esa llamada es rápida y no depende de Overpass.
 *
 * roadTileCache      : Map(tileKey -> "loaded" | Promise<void>) — evita
 *                       pedir el mismo archivo de tile dos veces.
 * chunkRawDataCache   : Map(chunkKey -> roads[] SIN alturas) — se llena
 *                       al procesar un tile (un tile de 2 km llena ~180 chunks de
 *                       una sola vez).
 */
const ROAD_TILE_SIZE_METERS = 2000;
const ROAD_TILES_BASE_URL = "data/tiles/"; // relativo a index.html

let roadTileCache = new Map();       // tileKey -> "loaded" | Promise
let chunkRawDataCache = new Map();   // chunkKey -> roads[] (sin alturas todavía)

function tileCoordsForXY(x, y){
  return {
    tx: Math.floor(x / ROAD_TILE_SIZE_METERS),
    ty: Math.floor(y / ROAD_TILE_SIZE_METERS),
  };
}

function tileKeyFor(tx, ty){
  return `${tx}_${ty}`;
}

function tileKeyForChunk(cx, cy){
  // Usamos el CENTRO del chunk (mismo criterio que usó el script offline
  // al asignar cada vía a un tile por su primer nodo) para saber qué
  // archivo de tile hay que pedir para llenar este chunk.
  const x = cx * ROAD_CHUNK_SIZE_METERS + ROAD_CHUNK_SIZE_METERS / 2;
  const y = cy * ROAD_CHUNK_SIZE_METERS + ROAD_CHUNK_SIZE_METERS / 2;
  const { tx, ty } = tileCoordsForXY(x, y);
  return tileKeyFor(tx, ty);
}

/**
 * ensureTileLoaded — descarga (si no está en caché) el archivo estático
 * de un tile y reparte sus vías entre los chunks de 150 m que le
 * corresponden (chunkRawDataCache). Un 404 (tile sin calles — p.ej. un
 * cerro, un parque grande, o directamente fuera de lo generado) se trata
 * como "sin datos", NUNCA como error que bloquee el streaming.
 */
function ensureTileLoaded(tileKey){
  const cached = roadTileCache.get(tileKey);
  if (cached === "loaded") return Promise.resolve();
  if (cached instanceof Promise) return cached;

  const promise = (async () => {
    let roads = [];
    try {
      const response = await fetch(`${ROAD_TILES_BASE_URL}${tileKey}.json`);
      if (response.ok) {
        roads = await response.json();
      } else if (response.status !== 404) {
        console.warn(`Tile ${tileKey}: respuesta ${response.status} al pedirlo (se trata como vacío).`);
      }
    } catch (error) {
      // Sin conexión momentánea, etc. — no bloquea el streaming, ese
      // tile simplemente queda sin calles hasta el próximo intento
      // (se reintentará solo si el chunk se vuelve a pedir más tarde,
      // porque acá NO marcamos el tile como "loaded").
      console.warn(`No se pudo cargar el tile ${tileKey}:`, error);
      roadTileCache.delete(tileKey);
      return;
    }

    for (const road of roads){
      if (!road.coordinates || road.coordinates.length < 2) continue;
      const [firstLon, firstLat] = road.coordinates[0];
      const { cx, cy } = chunkCoordsForLonLat(firstLon, firstLat);
      const chunkKey = chunkKeyFor(cx, cy);
      if (!chunkRawDataCache.has(chunkKey)) chunkRawDataCache.set(chunkKey, []);
      chunkRawDataCache.get(chunkKey).push({
        id: road.id,
        highwayType: road.highwayType,
        name: road.name || null,
        coordinates: road.coordinates.map(([lon, lat]) => ({ lon, lat })),
      });
    }

    roadTileCache.set(tileKey, "loaded");
  })();

  roadTileCache.set(tileKey, promise);
  return promise;
}

/**
 * sampleRoadElevations — cruza cada nodo de cada vía con la altimetría
 * real de los 3D Tiles (sampleHeightMostDetailed), en tandas de
 * ROAD_SAMPLE_BATCH puntos para no bloquear el hilo principal. El
 * progreso mostrado ("N/total puntos") es sobre el conjunto COMPLETO que
 * se le pase — por eso siempre se le pasa de una sola vez toda el área
 * que se está cargando en ese momento, nunca en llamadas separadas por
 * chunkcito, así la barra avanza de forma continua y realmente converge.
 */
async function sampleRoadElevations(roads){
  const flatCartographics = [];
  const backrefs = []; // [roadIndex, pointIndex]

  roads.forEach((road, ri) => {
    road.heights = new Array(road.coordinates.length).fill(0);
    road.coordinates.forEach((coord, pi) => {
      flatCartographics.push(Cesium.Cartographic.fromDegrees(coord.lon, coord.lat));
      backrefs.push([ri, pi]);
    });
  });

  for (let i = 0; i < flatCartographics.length; i += ROAD_SAMPLE_BATCH) {
    const batch = flatCartographics.slice(i, i + ROAD_SAMPLE_BATCH);
    const batchRefs = backrefs.slice(i, i + ROAD_SAMPLE_BATCH);

    const sampled = await viewer.scene.sampleHeightMostDetailed(batch);

    (sampled || batch).forEach((carto, j) => {
      const [ri, pi] = batchRefs[j];
      roads[ri].heights[pi] = carto?.height ?? 0;
    });

    setLoadingStep(
      "stepElevation", "active",
      `Muestreando elevación… ${Math.min(i + ROAD_SAMPLE_BATCH, flatCartographics.length)}/${flatCartographics.length} puntos`
    );

    await yieldToMain();
  }

  return roads;
}

/**
 * buildRoadMeshesForChunk — con las alturas ya calculadas, genera la malla
 * "corridor" de cada vía y la agrega tanto al chunk (para poder
 * descargarla después) como al registro global roadEntityByWay
 * (reutilizado para no duplicar geometría). Si una vía ya tiene entidad,
 * se reutiliza en vez de crear una nueva.
 */
function buildRoadMeshesForChunk(chunk, roads){
  const entities = [];

  roads.forEach((road) => {
    if (road.coordinates.length < 2) return;
    if (roadEntityByWay.has(road.id)) {
      const existing = roadEntityByWay.get(road.id);
      if (!chunk.entities.includes(existing)) chunk.entities.push(existing);
      entities.push(existing);
      return;
    }

    const positions = road.coordinates.map((coord, i) =>
      Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, road.heights[i] + ROAD_SURFACE_OFFSET)
    );

    const width = ROAD_WIDTH_BY_TYPE[road.highwayType] ?? ROAD_WIDTH_DEFAULT;

    const entity = viewer.entities.add({
      name: road.name || `Vía OSM ${road.id} (${road.highwayType})`,
      corridor: {
        positions: positions,
        width: width,
        cornerType: Cesium.CornerType.ROUNDED,
        material: Cesium.Color.fromCssColorString("#3B3B38"),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#E8B93A").withAlpha(0.35),
      },
    });

    roadEntityByWay.set(road.id, entity);
    chunk.wayIds.add(road.id);
    chunk.entities.push(entity);
    entities.push(entity);
  });

  return entities;
}

/**
 * loadRoadChunk — pipeline de UN chunk de streaming (150 m): asegura que
 * el tile que lo contiene esté cargado (fetch local, cacheado), toma sus
 * vías crudas desde chunkRawDataCache, las eleva (si no estaban ya
 * elevadas de una carga anterior) y construye la malla. Nunca bloquea el
 * hilo principal por mucho tiempo: cede el control entre fases.
 */
async function loadRoadChunk(chunkKey){
  const chunk = roadChunks.get(chunkKey);
  if (!chunk) return;
  chunk.status = "loading";

  try {
    let roadsWithHeights = roadChunkDataCache.get(chunkKey);

    if (!roadsWithHeights) {
      const tileKey = tileKeyForChunk(chunk.cx, chunk.cy);
      await ensureTileLoaded(tileKey);

      const rawRoads = chunkRawDataCache.get(chunkKey) || [];
      roadsWithHeights = rawRoads.length > 0 ? await sampleRoadElevations(rawRoads) : [];
      roadChunkDataCache.set(chunkKey, roadsWithHeights);
    }

    if (roadsWithHeights.length > 0) buildRoadMeshesForChunk(chunk, roadsWithHeights);
    chunk.status = "loaded";
    viewer.scene.requestRender();
  } catch (error) {
    console.error(`Error generando el chunk vial ${chunkKey}:`, error);
    chunk.status = "error";
    chunk.lastError = error;
  }
}

/**
 * processRoadLoadQueue — procesa la cola de chunks pendientes de a poco
 * (ROAD_MAX_CHUNK_LOADS_PER_TICK por pasada), cediendo el hilo principal
 * entre cada chunk para no bloquear la interfaz ni la cámara/auto mientras
 * se generan mallas nuevas.
 */
async function processRoadLoadQueue(){
  if (isProcessingRoadQueue) return;
  isProcessingRoadQueue = true;

  try {
    while (roadLoadQueue.length > 0){
      let processedThisPass = 0;

      while (processedThisPass < ROAD_MAX_CHUNK_LOADS_PER_TICK && roadLoadQueue.length > 0){
        const chunkKey = roadLoadQueue.shift();
        roadQueueSet.delete(chunkKey);

        const chunk = roadChunks.get(chunkKey);
        if (!chunk) { continue; } // fue removido (p.ej. quedó lejos antes de procesarse)

        updateHudStreamingStatus();
        await loadRoadChunk(chunkKey);
        processedThisPass++;
      }

      updateHudStreamingStatus();
      // Cede el hilo principal entre tandas para que la cámara orbital y
      // el resto de la simulación sigan respondiendo con fluidez.
      await yieldToMain();
    }
  } finally {
    isProcessingRoadQueue = false;
    updateHudStreamingStatus();
  }
}

function enqueueChunkLoad(chunkKey){
  if (roadQueueSet.has(chunkKey)) return;
  roadQueueSet.add(chunkKey);
  roadLoadQueue.push(chunkKey);
}

/**
 * unloadFarRoadChunks — descarga (quita de la escena) los chunks cuya
 * distancia al auto supera ROAD_UNLOAD_RADIUS_METERS. Los datos ya
 * descargados/elevados se mantienen en roadChunkDataCache (y los tiles
 * crudos en chunkRawDataCache/roadTileCache), así que si el auto vuelve a
 * esa zona la malla se reconstruye al instante, sin volver a pedir nada
 * por red.
 */
function unloadFarRoadChunks(carX, carY){
  for (const [chunkKey, chunk] of roadChunks){
    if (chunk.status !== "loaded") continue;

    const chunkX = chunk.cx * ROAD_CHUNK_SIZE_METERS + ROAD_CHUNK_SIZE_METERS / 2;
    const chunkY = chunk.cy * ROAD_CHUNK_SIZE_METERS + ROAD_CHUNK_SIZE_METERS / 2;
    const dist = Math.hypot(carX - chunkX, carY - chunkY);

    if (dist > ROAD_UNLOAD_RADIUS_METERS){
      chunk.entities.forEach((e) => {
        viewer.entities.remove(e);
        for (const [wayId, entity] of roadEntityByWay){
          if (entity === e) roadEntityByWay.delete(wayId);
        }
      });
      chunk.entities = [];
      roadChunks.delete(chunkKey);
      // roadChunkDataCache / chunkRawDataCache / roadTileCache se
      // conservan a propósito (caché local, sin costo de red al recargar).
    }
  }
  viewer.scene.requestRender();
}

function updateHudStreamingStatus(){
  let loaded = 0;
  for (const chunk of roadChunks.values()){
    if (chunk.status === "loaded") loaded++;
  }
  roadStreamStats = { loaded, queued: roadLoadQueue.length };
  if (hudStatus){
    hudStatus.textContent = roadLoadQueue.length > 0
      ? `Streaming de calles: ${loaded} chunks cargados, ${roadLoadQueue.length} generando…`
      : `Streaming de calles: ${loaded} chunks cargados (radio ${ROAD_LOAD_RADIUS_METERS} m, mundo ${(ROAD_WORLD_RADIUS_METERS/1000).toFixed(0)} km)`;
  }
}

/**
 * updateRoadStreaming — corazón del streaming: dado la posición actual del
 * auto, calcula qué chunks deberían estar cargados (dentro de
 * ROAD_LOAD_RADIUS_METERS) y los encola si faltan, y descarga los que
 * quedaron más allá de ROAD_UNLOAD_RADIUS_METERS (histéresis). Nunca
 * genera nada fuera de ROAD_WORLD_RADIUS_METERS desde el centro de
 * Santiago, que sigue siendo el límite máximo del mundo/mapa — pero eso
 * solo importa para no pedir tiles inexistentes; el archivo de tiles ya
 * fue generado una sola vez para todo ese radio.
 */
function updateRoadStreaming(carLon, carLat){
  const { x: carX, y: carY } = lonLatToLocalXY(carLon, carLat);

  const distCarToCenter = Math.hypot(carX, carY);
  if (distCarToCenter <= ROAD_WORLD_RADIUS_METERS + ROAD_LOAD_RADIUS_METERS){
    const { cx: carCx, cy: carCy } = chunkCoordsForLonLat(carLon, carLat);
    const chunkSpan = Math.ceil(ROAD_LOAD_RADIUS_METERS / ROAD_CHUNK_SIZE_METERS) + 1;

    for (let dcx = -chunkSpan; dcx <= chunkSpan; dcx++){
      for (let dcy = -chunkSpan; dcy <= chunkSpan; dcy++){
        const cx = carCx + dcx;
        const cy = carCy + dcy;
        const chunkX = cx * ROAD_CHUNK_SIZE_METERS + ROAD_CHUNK_SIZE_METERS / 2;
        const chunkY = cy * ROAD_CHUNK_SIZE_METERS + ROAD_CHUNK_SIZE_METERS / 2;
        const dist = Math.hypot(carX - chunkX, carY - chunkY);
        if (dist > ROAD_LOAD_RADIUS_METERS) continue;

        const centerDist = Math.hypot(chunkX, chunkY);
        if (centerDist > ROAD_WORLD_RADIUS_METERS) continue;

        const key = chunkKeyFor(cx, cy);
        if (roadChunks.has(key)) continue;
        if (roadQueueSet.has(key)) continue;

        const center = chunkCenterLonLat(cx, cy);
        roadChunks.set(key, {
          cx, cy, centerLon: center.lon, centerLat: center.lat,
          status: "queued", entities: [], wayIds: new Set(),
        });
        enqueueChunkLoad(key);
      }
    }
  }

  unloadFarRoadChunks(carX, carY);

  if (roadLoadQueue.length > 0 && !isProcessingRoadQueue){
    processRoadLoadQueue();
  }

  updateHudStreamingStatus();
}

/**
 * startRoadStreaming — arranca el watcher periódico que sigue la posición
 * del auto y dispara updateRoadStreaming cuando se movió lo suficiente
 * (ROAD_STREAM_MOVE_THRESHOLD) desde el último chequeo. Corre con
 * setInterval en vez de en cada frame para no gastar CPU de más — la
 * cámara/auto siguen funcionando con total normalidad mientras tanto.
 */
function startRoadStreaming(){
  if (roadStreamingActive) return;
  roadStreamingActive = true;

  roadStreamTimerId = setInterval(() => {
    if (!audiEntity || !viewer) return;

    const now = viewer.clock.currentTime;
    const position = audiEntity.position.getValue(now);
    if (!position) return;

    const carto = Cesium.Cartographic.fromCartesian(position);
    if (!carto) return;
    const carLon = Cesium.Math.toDegrees(carto.longitude);
    const carLat = Cesium.Math.toDegrees(carto.latitude);
    const { x, y } = lonLatToLocalXY(carLon, carLat);

    if (lastStreamCarX !== null){
      const moved = Math.hypot(x - lastStreamCarX, y - lastStreamCarY);
      if (moved < ROAD_STREAM_MOVE_THRESHOLD) return;
    }

    lastStreamCarX = x;
    lastStreamCarY = y;
    updateRoadStreaming(carLon, carLat);
  }, ROAD_STREAM_CHECK_INTERVAL_MS);
}

function stopRoadStreaming(){
  if (roadStreamTimerId !== null){
    clearInterval(roadStreamTimerId);
    roadStreamTimerId = null;
  }
  roadStreamingActive = false;
}

/**
 * generateInitialRoadPatch — genera SOLO las calles dentro de
 * ROAD_LOAD_RADIUS_METERS del punto de spawn (no los 45 km completos), y
 * luego deja andando el streaming continuo para el resto del recorrido.
 *
 * Ya no hay ninguna consulta a Overpass acá: se determinan los tiles
 * estáticos que cubren el radio inicial (típicamente 1 a 4 archivos de
 * ~4 km² cada uno), se piden en paralelo (fetch local, rápido), se agrupan sus
 * vías en chunks, y se hace UN solo muestreo de elevación combinado para
 * que la barra de progreso "Muestreando elevación…" avance de forma
 * continua y realmente termine.
 */
async function generateInitialRoadPatch(spawnLon, spawnLat){
  try {
    setLoadingStep("stepOsm", "active", "Cargando archivo local de calles (sin llamadas a Overpass)…");

    const { x: spawnX, y: spawnY } = lonLatToLocalXY(spawnLon, spawnLat);
    const margin = ROAD_CHUNK_SIZE_METERS;
    const minTile = tileCoordsForXY(spawnX - ROAD_LOAD_RADIUS_METERS - margin, spawnY - ROAD_LOAD_RADIUS_METERS - margin);
    const maxTile = tileCoordsForXY(spawnX + ROAD_LOAD_RADIUS_METERS + margin, spawnY + ROAD_LOAD_RADIUS_METERS + margin);

    const tileFetches = [];
    for (let tx = minTile.tx; tx <= maxTile.tx; tx++){
      for (let ty = minTile.ty; ty <= maxTile.ty; ty++){
        tileFetches.push(ensureTileLoaded(tileKeyFor(tx, ty)));
      }
    }
    await Promise.all(tileFetches);

    // Junta todos los chunks que caen dentro del radio inicial y saca sus
    // vías crudas (ya en memoria gracias a los tiles recién cargados).
    const { cx: spawnCx, cy: spawnCy } = chunkCoordsForLonLat(spawnLon, spawnLat);
    const chunkSpan = Math.ceil((ROAD_LOAD_RADIUS_METERS + margin) / ROAD_CHUNK_SIZE_METERS);
    const initialChunkKeys = [];

    for (let dcx = -chunkSpan; dcx <= chunkSpan; dcx++){
      for (let dcy = -chunkSpan; dcy <= chunkSpan; dcy++){
        const cx = spawnCx + dcx;
        const cy = spawnCy + dcy;
        const chunkX = cx * ROAD_CHUNK_SIZE_METERS + ROAD_CHUNK_SIZE_METERS / 2;
        const chunkY = cy * ROAD_CHUNK_SIZE_METERS + ROAD_CHUNK_SIZE_METERS / 2;
        if (Math.hypot(spawnX - chunkX, spawnY - chunkY) > ROAD_LOAD_RADIUS_METERS) continue;
        initialChunkKeys.push(chunkKeyFor(cx, cy));
      }
    }

    const allRoads = [];
    const roadsPerChunkKey = new Map();
    for (const chunkKey of initialChunkKeys){
      const raw = chunkRawDataCache.get(chunkKey) || [];
      roadsPerChunkKey.set(chunkKey, raw);
      allRoads.push(...raw);
    }

    markStepDone("stepOsm", `${allRoads.length} vías cargadas desde archivo local en el radio inicial de ${ROAD_LOAD_RADIUS_METERS} m.`);
    if (allRoads.length === 0) {
      console.warn(
        "[SantiagoGames] No se encontraron vías en data/tiles/ para esta zona. " +
        "¿Corriste `node scripts/fetch-roads.mjs` y pusheaste la carpeta data/tiles/? " +
        "Ver INSTRUCCIONES.md."
      );
    }

    if (allRoads.length > 0){
      setLoadingStep("stepElevation", "active", "Muestreando elevación real…");
      await sampleRoadElevations(allRoads); // una sola pasada, progreso continuo y coherente
      markStepDone("stepElevation", "Elevación real aplicada a cada tramo.");

      setLoadingStep("stepMesh", "active", "Generando malla procedural…");
      let builtChunks = 0;
      for (const [cxcy, cx, cy] of initialChunkKeys.map((k) => [k, ...k.split("_").map(Number)])){
        const roads = roadsPerChunkKey.get(cxcy);
        if (!roads || roads.length === 0) continue;

        const center = chunkCenterLonLat(cx, cy);
        const chunk = {
          cx, cy, centerLon: center.lon, centerLat: center.lat,
          status: "loaded", entities: [], wayIds: new Set(),
        };
        roadChunks.set(cxcy, chunk);
        roadChunkDataCache.set(cxcy, roads);
        buildRoadMeshesForChunk(chunk, roads);
        builtChunks++;
        if (builtChunks % 4 === 0) await yieldToMain();
      }
      markStepDone("stepMesh", `${allRoads.length} tramos generados en ${builtChunks} chunks.`);
    } else {
      setLoadingStep("stepElevation", "done", "Sin vías en el radio inicial — se omite elevación.");
      setLoadingStep("stepMesh", "done", "Sin malla que generar en el radio inicial.");
    }

    lastStreamCarX = null; // fuerza una primera evaluación real del watcher
    lastStreamCarY = null;
    startRoadStreaming();
  } catch (error) {
    // Un fallo puntual (p.ej. data/tiles/ no desplegado, o un problema de
    // red local) NO debe bloquear la simulación: se informa como error
    // real (no como "atascado") y el streaming se deja igual en marcha,
    // reintentará solo cuando el auto se mueva.
    console.error("Error generando el parche vial inicial:", error);
    setLoadingStep("stepOsm", "error", "No se pudo cargar el archivo local de calles (¿falta desplegar data/tiles/? ver consola).");
    startRoadStreaming();
  }
}

/**
 * spawnAudiQuattro — coloca el Audi Quattro en el punto de spawn fijo
 * (SPAWN_LON, SPAWN_LAT) orientado a SPAWN_HEADING_DEG (330–335°, NNO),
 * y deja la cámara por defecto detrás del auto (vista de conducción),
 * sin importar qué juego se haya seleccionado en el selector.
 */
async function spawnAudiQuattro(){
  setLoadingStep("stepSpawn", "active", "Posicionando el Audi Quattro…");

  // Muestrea la altura real del terreno/edificios de los 3D Tiles en el
  // punto de spawn, para que el auto quede apoyado en el suelo y no
  // flotando o enterrado.
  const carto = Cesium.Cartographic.fromDegrees(SPAWN_LON, SPAWN_LAT);
  let groundHeight = 0;
  try {
    const sampled = await viewer.scene.sampleHeightMostDetailed([carto]);
    if (sampled && sampled[0] && isFinite(sampled[0].height)) {
      groundHeight = sampled[0].height;
    }
  } catch (e) {
    console.warn("No se pudo muestrear la altura del terreno en el spawn, usando 0.", e);
  }

  const carPosition = Cesium.Cartesian3.fromDegrees(SPAWN_LON, SPAWN_LAT, groundHeight);
  const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(SPAWN_HEADING_DEG), 0, 0);
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(carPosition, hpr);

  if (audiEntity) {
    viewer.entities.remove(audiEntity);
  }

  audiEntity = viewer.entities.add({
    name: "1988 Audi Quattro",
    position: carPosition,
    orientation: orientation,
    model: {
      uri: AUDI_MODEL_URL,
      minimumPixelSize: 96,
      maximumScale: 20000,
      scale: 1.0,
    },
  });

  // Cámara en tercera persona, orbitable alrededor del auto: al usar
  // trackedEntity, Cesium ancla el pivote de la cámara al auto en vez
  // de al globo — arrastrar con el mouse orbita alrededor del Audi
  // (no mueve/paneas la escena completa), y el scroll acerca/aleja.
  viewer.trackedEntity = audiEntity;
  await viewer.flyTo(audiEntity, {
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(SPAWN_HEADING_DEG), // detrás del auto, mismo heading
      Cesium.Math.toRadians(-18),                // ligeramente por arriba, mirando hacia abajo
      16                                          // metros de distancia (rango orbital inicial)
    ),
  });

  markStepDone("stepSpawn", "Audi Quattro listo en el spawn.");
}

function goToSimulation(gameName){
  selectorScreen.hidden = true;
  simScreen.hidden = false;
  initSimulation(gameName);
  if (viewer){
    viewer.resize();
  }
}

function goToSelector(){
  simScreen.hidden = true;
  selectorScreen.hidden = false;
  // El streaming de calles se detiene mientras no se está viendo la
  // simulación (no tiene sentido seguir generando/descargando chunks).
  // Se reactiva solo con el watcher; no se pierde el progreso: los chunks
  // cargados y la caché de tiles locales siguen intactos en memoria.
  stopRoadStreaming();
}

selectBtn.addEventListener("click", () => {
  const game = GAMES[current];
  goToSimulation(game.name);
});

backBtn.addEventListener("click", goToSelector);

/* ===================== SISTEMA DE OPTIMIZACIÓN (GeoDrive) ===================== */

/**
 * applyGdOptimizations — vuelca gdSettings + GD_AUTO_OPTIMIZATIONS sobre el
 * tileset y la escena, reutilizando exactamente los mismos mecanismos que
 * usa GeoDrive (no se reimplementa nada en paralelo):
 *   - maximumScreenSpaceError            → nivel de detalle / LOD
 *   - cullWithChildrenBounds + skipLOD   → occlusion / frustum culling
 *   - scene.globe.depthTestAgainstTerrain→ profundidad contra terreno
 *   - maximumMemoryUsage                 → gestión de memoria de tiles
 *   - dynamicScreenSpaceError(*)         → reduce trabajo de GPU/CPU lejos
 *     de cámara sin sacrificar calidad cercana
 */
function applyGdOptimizations(){
  if (!tileset) return;

  tileset.maximumScreenSpaceError = gdSettings.screenSpaceError;

  // Occlusion / frustum culling — igual que GeoDrive: solo se procesan
  // subárboles de tiles cuyo bounding volume intersecta el frustum, y se
  // evita el "fantasma" de tiles fuera de vista mediante skipLevelOfDetail.
  tileset.cullWithChildrenBounds = gdSettings.occlusionCulling;
  tileset.cullRequestsWhileMoving = gdSettings.occlusionCulling;
  tileset.cullRequestsWhileMovingMultiplier = 1;
  tileset.skipLevelOfDetail = gdSettings.occlusionCulling
    ? GD_AUTO_OPTIMIZATIONS.skipLevelOfDetail
    : false;

  // Depth test contra terreno — evita que edificios/objetos se dibujen
  // "a través" de colinas u otros elementos que deberían ocultarlos.
  if (viewer && viewer.scene && viewer.scene.globe){
    viewer.scene.globe.depthTestAgainstTerrain = gdSettings.depthAgainstTerrain;
  }

  // Optimizaciones automáticas de GeoDrive — LOD dinámico, reducción de
  // carga de GPU/CPU para tiles lejanos, y techo de memoria para no
  // acumular geometría fuera del área relevante.
  tileset.dynamicScreenSpaceError = GD_AUTO_OPTIMIZATIONS.dynamicScreenSpaceError;
  tileset.dynamicScreenSpaceErrorDensity = GD_AUTO_OPTIMIZATIONS.dynamicScreenSpaceErrorDensity;
  tileset.baseScreenSpaceError = GD_AUTO_OPTIMIZATIONS.baseScreenSpaceError;
  tileset.skipScreenSpaceErrorFactor = GD_AUTO_OPTIMIZATIONS.skipScreenSpaceErrorFactor;
  tileset.skipLevels = GD_AUTO_OPTIMIZATIONS.skipLevels;
  tileset.preferLeaves = GD_AUTO_OPTIMIZATIONS.preferLeaves;
  tileset.progressiveResolutionHeightFraction = GD_AUTO_OPTIMIZATIONS.progressiveResolutionHeightFraction;
  tileset.maximumMemoryUsage = gdSettings.occlusionCulling
    ? 32 // igual que GeoDrive: cuando el culling agresivo está ON, se
         // "hambrea" el caché para descartar tiles apenas salen de vista
    : GD_AUTO_OPTIMIZATIONS.maximumMemoryUsage;

  // Descarga/recorte activo de tiles fuera de vista (misma lógica de
  // GeoDrive: trimLoadedTiles() en cada frame renderizado cuando el
  // culling agresivo está activo, para no retener geometría innecesaria).
  if (viewer && viewer.scene){
    if (gdSettings.occlusionCulling && !_gdGridTrimHandler){
      _gdGridTrimHandler = viewer.scene.postRender.addEventListener(() => {
        if (tileset && typeof tileset.trimLoadedTiles === "function"){
          tileset.trimLoadedTiles();
        }
      });
    } else if (!gdSettings.occlusionCulling && _gdGridTrimHandler){
      _gdGridTrimHandler(); // remueve el listener
      _gdGridTrimHandler = null;
    }
  }

  if (viewer && viewer.scene) viewer.scene.requestRender();
}

/**
 * startGdRenderDistanceWatcher — misma técnica que GeoDrive: en cada frame
 * (postRender) compara la altura de cámara contra gdSettings.renderDistance
 * y oculta el tileset por completo más allá de ese umbral, evitando
 * procesar/renderizar geometría fuera del área relevante.
 */
function startGdRenderDistanceWatcher(){
  if (!viewer || !viewer.scene) return;
  viewer.scene.postRender.addEventListener(() => {
    if (!tileset) return;
    const carto = viewer.scene.camera.positionCartographic;
    if (!carto || !isFinite(carto.height)) return;
    const isFar = carto.height > gdSettings.renderDistance;
    if (isFar !== _gdDistanceIsFar){
      _gdDistanceIsFar = isFar;
      tileset.show = !isFar;
      viewer.scene.requestRender();
    }
  });
}

/* ===================== PANEL DE CONFIGURACIÓN (UI) ===================== */

const settingsBtn = document.getElementById("settingsBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");

const sseSlider = document.getElementById("sseSlider");
const sseValue = document.getElementById("sseValue");
const occlusionToggle = document.getElementById("occlusionToggle");
const depthTerrainToggle = document.getElementById("depthTerrainToggle");
const renderDistanceSlider = document.getElementById("renderDistanceSlider");
const renderDistanceValue = document.getElementById("renderDistanceValue");

function openSettings(){
  settingsOverlay.hidden = false;
}

function closeSettings(){
  settingsOverlay.hidden = true;
}

settingsBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettings();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !settingsOverlay.hidden) closeSettings();
});

sseSlider.addEventListener("input", () => {
  gdSettings.screenSpaceError = Number(sseSlider.value);
  sseValue.textContent = sseSlider.value;
  applyGdOptimizations();
});

occlusionToggle.addEventListener("change", () => {
  gdSettings.occlusionCulling = occlusionToggle.checked;
  applyGdOptimizations();
});

depthTerrainToggle.addEventListener("change", () => {
  gdSettings.depthAgainstTerrain = depthTerrainToggle.checked;
  applyGdOptimizations();
});

renderDistanceSlider.addEventListener("input", () => {
  gdSettings.renderDistance = Number(renderDistanceSlider.value);
  renderDistanceValue.textContent = `${renderDistanceSlider.value} m`;
  _gdDistanceIsFar = null; // fuerza reevaluación inmediata en el próximo frame
});

/* ============================== ARRANQUE ============================== */
// Marcador de versión: si en la consola del navegador NO ves este mensaje,
// el navegador/GitHub Pages está sirviendo un script.js viejo en caché —
// hacé un hard refresh (o recarga forzada) antes de reportar cualquier
// bug de carga/streaming.
console.log("[SantiagoGames] script.js — streaming de calles v2 (consulta única + progreso continuo)");

// Al cargar la página SIEMPRE se ve primero el selector.
// La simulación queda oculta (`hidden`) y su inicialización de Cesium
// solo ocurre dentro de initSimulation(), llamada exclusivamente desde
// el click en "Seleccionar".
buildCards();
render();
