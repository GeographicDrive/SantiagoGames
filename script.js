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
// solo mantiene construida la malla de las vías de los tiles cercanos al
// auto.
//
// CARGA POR TILE (reemplaza el viejo streaming por grillas finas de 150 m).
// Como los datos ya son archivos estáticos locales (no Overpass en vivo),
// no hace falta trocear cada tile de 2 km en decenas de "chunks" con cola
// y descarga con histéresis: alcanza con cargar/descargar el tile de
// 2×2 km completo (mismo tamaño que ya generó scripts/fetch-roads.mjs) al
// que pertenece el auto, más un anillo de tiles vecinos alrededor.
//   - El mapa/mundo sigue limitado a ROAD_WORLD_RADIUS_METERS (45 km).
//   - Se mantienen cargados los tiles a ROAD_TILE_LOAD_MARGIN_TILES de
//     distancia (en la grilla) del tile donde está el auto — con margen 1
//     eso es una grilla de 3×3 tiles (~6×6 km) siempre alrededor del auto.
//   - Un tile se descarga (se sacan sus entidades de la escena) apenas deja
//     de estar en esa grilla 3×3; sus vías ya elevadas quedan en memoria
//     (roadTiles) por si el auto vuelve, así no hay que re-pedir el archivo
//     ni re-muestrear elevación.
const ROAD_WORLD_RADIUS_METERS = 45000;      // límite máximo del mundo/mapa
const ROAD_TILE_LOAD_MARGIN_TILES = 1;       // anillo de tiles vecinos (1 = grilla 3×3)
const ROAD_STREAM_CHECK_INTERVAL_MS = 500;   // cada cuánto se revisa el tile actual del auto
const ROAD_SAMPLE_BATCH = 250;        // nodos por tanda en sampleHeightMostDetailed
const ROAD_SAMPLE_CONCURRENT_BATCHES = 6; // tandas en vuelo al mismo tiempo (el cuello de botella es red, no CPU)
const ROAD_SAMPLE_STRIDE = 4; // Muestreo disperso: solo se pide 1 de cada N nodos y el resto
                               // se interpola linealmente entre los muestreados (splines simples
                               // de tramo recto). Corta ~75% de los requests de red sin
                               // notarse visualmente, porque los nodos de OSM ya son densos.
const ROAD_SURFACE_OFFSET = 0.15; // metros sobre el terreno, evita z-fighting

// Ancho aproximado (m) por tipo de vía OSM.
const ROAD_WIDTH_BY_TYPE = {
  motorway: 12, trunk: 11, primary: 10, secondary: 9, tertiary: 8,
  unclassified: 7, residential: 7, service: 4.5, living_street: 6,
  pedestrian: 4, footway: 2, cycleway: 2.5, track: 4, path: 2,
};
const ROAD_WIDTH_DEFAULT = 6;

/* ---- Estado del sistema de carga de calles por tile ----
   roadTiles      : Map(tileKey -> { tx, ty, status, entities:[], roads:[] })
                    — un registro por tile de 2×2 km. `roads` guarda las
                    vías YA elevadas (sobrevive a la descarga del tile, para
                    no re-pedir el archivo ni re-muestrear elevación si el
                    auto vuelve a esa zona). `entities` son las que están
                    actualmente puestas en la escena (vacío si el tile está
                    descargado pero sigue en caché).
   roadEntityByWay: Map(wayId -> entity) — evita duplicar geometría.
*/
let roadTiles = new Map();
let roadEntityByWay = new Map();
let roadStreamingActive = false;
let roadStreamTimerId = null;
let lastStreamCarTx = null;
let lastStreamCarTy = null;
let roadStreamStats = { loaded: 0, loading: 0 };

// Mantenido por compatibilidad con el resto del código (p.ej. limpieza total).
let roadEntities = [];

function yieldToMain(){
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * sampleHeightMostDetailedSafe — envoltorio de scene.sampleHeightMostDetailed
 * con timeout. Sin esto, si Cesium no logra cargar los tiles necesarios para
 * las posiciones pedidas (p.ej. porque cullRequestsWhileMoving descarta esas
 * solicitudes), la promesa original puede quedar colgada para siempre. Acá
 * simplemente se resuelve con null pasado el timeout, para que quien llama
 * pueda seguir (usando una altura de respaldo) en vez de trabarse.
 */
function sampleHeightMostDetailedSafe(positions, timeoutMs = 8000){
  return Promise.race([
    viewer.scene.sampleHeightMostDetailed(positions),
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]).catch(() => null);
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

function tileCoordsForLonLat(lon, lat){
  const { x, y } = lonLatToLocalXY(lon, lat);
  return tileCoordsForXY(x, y);
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
  dynamicScreenSpaceError: true,        // GeoDrive: mismo toggle del panel de Configuración
  dynamicScreenSpaceErrorDensity: 0.00278, // GeoDrive: mismo slider del panel de Configuración
};

// Optimizaciones automáticas de GeoDrive que permanecen SIEMPRE activas,
// sin exponerse en la UI (el usuario no necesita tocarlas manualmente).
const GD_AUTO_OPTIMIZATIONS = {
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
    lastStreamCarTx = null;
    lastStreamCarTy = null;
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
 * en tiempo real, y ya NO streaming por grillas finas de 150 m).
 * ======================================================================
 *
 * Antes había dos capas de streaming: Overpass en vivo (ya eliminado) y,
 * encima, un troceo fino de cada tile en decenas de "chunks" de 150 m con
 * cola propia e histéresis de descarga. Esa segunda capa tenía sentido
 * cuando los datos podían tardar en llegar por red; ahora que son
 * archivos JSON locales, agrega complejidad sin beneficio real. La unidad
 * de carga/descarga pasa a ser directamente el TILE (2×2 km, el mismo que
 * generó scripts/fetch-roads.mjs) — se carga un archivo, se eleva y se
 * construye su malla completa de una vez.
 *
 * roadTileCache : Map(tileKey -> "loaded" | Promise<void>) — evita pedir
 *                 el mismo archivo de tile dos veces mientras está en
 *                 vuelo.
 */
const ROAD_TILE_SIZE_METERS = 2000; // DEBE coincidir con --tile-size en scripts/fetch-roads.mjs
const ROAD_TILES_BASE_URL = "data/tiles/"; // relativo a index.html

let roadTileCache = new Map(); // tileKey -> "loaded" | Promise

function tileCoordsForXY(x, y){
  return {
    tx: Math.floor(x / ROAD_TILE_SIZE_METERS),
    ty: Math.floor(y / ROAD_TILE_SIZE_METERS),
  };
}

function tileKeyFor(tx, ty){
  return `${tx}_${ty}`;
}

function tileCenterLonLat(tx, ty){
  const x = tx * ROAD_TILE_SIZE_METERS + ROAD_TILE_SIZE_METERS / 2;
  const y = ty * ROAD_TILE_SIZE_METERS + ROAD_TILE_SIZE_METERS / 2;
  return localXYToLonLat(x, y);
}

/**
 * sampleRoadElevations — cruza cada nodo de cada vía con la altimetría
 * real de los 3D Tiles (sampleHeightMostDetailed), en tandas de
 * ROAD_SAMPLE_BATCH puntos para no bloquear el hilo principal.
 */
async function sampleRoadElevations(roads){
  const flatCartographics = [];
  const backrefs = []; // [roadIndex, pointIndex]

  // Muestreo disperso: por cada vía se piden solo los nodos 0, STRIDE,
  // 2*STRIDE, ... y siempre el último (para no cortar la punta). El resto
  // de los nodos intermedios se interpola linealmente entre los dos nodos
  // muestreados más cercanos — funciona muy bien acá porque los nodos de
  // OSM ya vienen densos (varios metros entre sí), así que un tramo de
  // pocos nodos es prácticamente recto.
  roads.forEach((road, ri) => {
    const n = road.coordinates.length;
    road.heights = new Array(n).fill(0);
    road._sampledIdx = []; // índices con altura real (no interpolada)

    for (let pi = 0; pi < n; pi += ROAD_SAMPLE_STRIDE){
      const coord = road.coordinates[pi];
      flatCartographics.push(Cesium.Cartographic.fromDegrees(coord.lon, coord.lat));
      backrefs.push([ri, pi]);
      road._sampledIdx.push(pi);
    }
    if (road._sampledIdx[road._sampledIdx.length - 1] !== n - 1){
      const coord = road.coordinates[n - 1];
      flatCartographics.push(Cesium.Cartographic.fromDegrees(coord.lon, coord.lat));
      backrefs.push([ri, n - 1]);
      road._sampledIdx.push(n - 1);
    }
  });

  // sampleHeightMostDetailed necesita poder pedir tiles nuevos para las
  // posiciones muestreadas. Si cullRequestsWhileMoving está activo (lo está
  // por defecto vía applyGdOptimizations), Cesium puede descartar esas
  // solicitudes indefinidamente y la promesa de sampleHeightMostDetailed
  // nunca se resuelve — el loop se queda pegado para siempre en el primer
  // lote. Lo desactivamos mientras dura el muestreo y lo restauramos al
  // terminar (o si algo falla).
  const prevCullRequestsWhileMoving = tileset?.cullRequestsWhileMoving;
  if (tileset) tileset.cullRequestsWhileMoving = false;

  // El cuello de botella real es de RED: por defecto Cesium solo permite
  // ~6 requests simultáneos por servidor (RequestScheduler), así que pedir
  // tandas una por una (secuencial) deja la mayoría de la conexión ociosa.
  // Subimos esos topes temporalmente y disparamos varias tandas EN PARALELO
  // (no una a la vez), y las restauramos al terminar.
  const RS = Cesium.RequestScheduler;
  const prevMaxRequests = RS.maximumRequests;
  const prevMaxRequestsPerServer = RS.maximumRequestsPerServer;
  RS.maximumRequests = Math.max(prevMaxRequests, 200);
  RS.maximumRequestsPerServer = Math.max(prevMaxRequestsPerServer, 24);

  // Durante el muestreo no necesitamos el tileset visible en máxima calidad:
  // subir el SSE de forma temporal hace que se resuelvan tiles más gruesos
  // (más rápido) mientras se calcula la altura de las vías. Se restaura al
  // terminar.
  const prevMaxSSE = tileset?.maximumScreenSpaceError;
  if (tileset) tileset.maximumScreenSpaceError = Math.max(prevMaxSSE ?? 16, 32);

  let completed = 0;
  const total = flatCartographics.length;

  async function runBatch(start){
    const batch = flatCartographics.slice(start, start + ROAD_SAMPLE_BATCH);
    const batchRefs = backrefs.slice(start, start + ROAD_SAMPLE_BATCH);

    const sampled = await sampleHeightMostDetailedSafe(batch);
    if (!sampled) {
      // No se pudo resolver a tiempo (tiles no disponibles todavía, etc.):
      // se sigue con altura 0 para ese lote en vez de trabar el streaming.
      console.warn("Muestreo de elevación: lote sin resolver, se usa altura 0.");
    }

    (sampled || batch).forEach((carto, j) => {
      const [ri, pi] = batchRefs[j];
      roads[ri].heights[pi] = carto?.height ?? 0;
    });

    completed += batch.length;
    setLoadingStep(
      "stepElevation", "active",
      `Muestreando elevación… ${Math.min(completed, total)}/${total} puntos (grilla dispersa 1/${ROAD_SAMPLE_STRIDE})`
    );
  }

  try {
    // Cola de tandas: se mantienen ROAD_SAMPLE_CONCURRENT_BATCHES en vuelo
    // en todo momento; apenas una termina, se lanza la siguiente.
    let nextStart = 0;
    const worker = async () => {
      while (nextStart < total) {
        const start = nextStart;
        nextStart += ROAD_SAMPLE_BATCH;
        await runBatch(start);
        await yieldToMain();
      }
    };
    const workers = [];
    for (let w = 0; w < ROAD_SAMPLE_CONCURRENT_BATCHES; w++) workers.push(worker());
    await Promise.all(workers);
  } finally {
    if (tileset) tileset.cullRequestsWhileMoving = prevCullRequestsWhileMoving;
    if (tileset) tileset.maximumScreenSpaceError = prevMaxSSE ?? tileset.maximumScreenSpaceError;
    RS.maximumRequests = prevMaxRequests;
    RS.maximumRequestsPerServer = prevMaxRequestsPerServer;
  }

  // Interpola linealmente los nodos que no se muestrearon directamente,
  // usando los dos nodos muestreados más cercanos a cada lado (tramo
  // "spline" recto entre alturas reales).
  roads.forEach((road) => {
    const idx = road._sampledIdx;
    for (let s = 0; s < idx.length - 1; s++){
      const a = idx[s], b = idx[s + 1];
      if (b - a <= 1) continue;
      const ha = road.heights[a], hb = road.heights[b];
      for (let pi = a + 1; pi < b; pi++){
        const t = (pi - a) / (b - a);
        road.heights[pi] = ha + (hb - ha) * t;
      }
    }
    delete road._sampledIdx;
  });

  return roads;
}

/**
 * buildRoadMeshesForTile — con las alturas ya calculadas, genera la malla
 * "corridor" de cada vía del tile y la agrega tanto al registro del tile
 * (para poder descargarla después) como al índice global roadEntityByWay
 * (reutilizado para no duplicar geometría si el tile se recarga).
 */
function buildRoadMeshesForTile(tile, roads){
  roads.forEach((road) => {
    if (road.coordinates.length < 2) return;
    if (roadEntityByWay.has(road.id)) {
      const existing = roadEntityByWay.get(road.id);
      if (!tile.entities.includes(existing)) tile.entities.push(existing);
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
    tile.entities.push(entity);
  });
}

/**
 * loadRoadTile — pipeline completo de UN tile (2×2 km): fetch del archivo
 * estático (si no estaba en caché), muestreo de elevación de todas sus
 * vías, y construcción de la malla. Si el tile ya tenía sus vías elevadas
 * en caché (roads no vacío) porque el auto ya había pasado por ahí antes,
 * se reconstruye la malla directo, sin volver a pedir nada por red.
 */
async function loadRoadTile(tileKey){
  const tile = roadTiles.get(tileKey);
  if (!tile) return;
  tile.status = "loading";
  updateHudStreamingStatus();

  try {
    if (!tile.roads) {
      let rawRoads = [];
      const cached = roadTileCache.get(tileKey);
      if (cached === "loaded") {
        rawRoads = tile._rawRoads || [];
      } else {
        const promise = cached instanceof Promise ? cached : (async () => {
          const response = await fetch(`${ROAD_TILES_BASE_URL}${tileKey}.json`);
          if (response.ok) return await response.json();
          if (response.status === 404) return []; // tile sin calles (cerro, parque, etc.)
          console.warn(`Tile ${tileKey}: respuesta ${response.status} (se trata como vacío).`);
          return [];
        })();
        roadTileCache.set(tileKey, promise);
        rawRoads = await promise;
        roadTileCache.set(tileKey, "loaded");
        tile._rawRoads = rawRoads;
      }

      const roads = rawRoads
        .filter((r) => r.coordinates && r.coordinates.length >= 2)
        .map((r) => ({
          id: r.id,
          highwayType: r.highwayType,
          name: r.name || null,
          coordinates: r.coordinates.map(([lon, lat]) => ({ lon, lat })),
        }));

      tile.roads = roads.length > 0 ? await sampleRoadElevations(roads) : [];
    }

    if (tile.roads.length > 0) buildRoadMeshesForTile(tile, tile.roads);
    tile.status = "loaded";
    viewer.scene.requestRender();
  } catch (error) {
    console.error(`Error cargando el tile vial ${tileKey}:`, error);
    tile.status = "error";
    roadTileCache.delete(tileKey); // permite reintentar en el próximo paso por acá
  }
  updateHudStreamingStatus();
}

/**
 * unloadRoadTile — saca de la escena las entidades de un tile que ya
 * quedó fuera de la grilla 3×3 alrededor del auto. Las vías ya elevadas
 * (tile.roads) se conservan en memoria a propósito, así reconstruir la
 * malla al volver es instantáneo y sin red.
 */
function unloadRoadTile(tileKey){
  const tile = roadTiles.get(tileKey);
  if (!tile) return;
  tile.entities.forEach((e) => {
    viewer.entities.remove(e);
    for (const [wayId, entity] of roadEntityByWay){
      if (entity === e) roadEntityByWay.delete(wayId);
    }
  });
  tile.entities = [];
  roadTiles.delete(tileKey);
}

function updateHudStreamingStatus(){
  let loaded = 0, loading = 0;
  for (const tile of roadTiles.values()){
    if (tile.status === "loaded") loaded++;
    else if (tile.status === "loading") loading++;
  }
  roadStreamStats = { loaded, loading };
  if (hudStatus){
    hudStatus.textContent = loading > 0
      ? `Calles: ${loaded} tiles cargados, ${loading} generando…`
      : `Calles: ${loaded} tiles cargados (grilla 3×3, mundo ${(ROAD_WORLD_RADIUS_METERS/1000).toFixed(0)} km)`;
  }
}

/**
 * neededTileKeysAround — la grilla de tiles que debería estar cargada
 * alrededor de una posición del mundo: el tile que la contiene más
 * ROAD_TILE_LOAD_MARGIN_TILES de anillo, recortada al límite del mundo
 * (ROAD_WORLD_RADIUS_METERS desde el centro de Santiago).
 */
function neededTileKeysAround(lon, lat){
  const { tx: carTx, ty: carTy } = tileCoordsForLonLat(lon, lat);
  const keys = [];
  for (let dtx = -ROAD_TILE_LOAD_MARGIN_TILES; dtx <= ROAD_TILE_LOAD_MARGIN_TILES; dtx++){
    for (let dty = -ROAD_TILE_LOAD_MARGIN_TILES; dty <= ROAD_TILE_LOAD_MARGIN_TILES; dty++){
      const tx = carTx + dtx;
      const ty = carTy + dty;
      const center = tileCenterLonLat(tx, ty);
      const { x, y } = lonLatToLocalXY(center.lon, center.lat);
      if (Math.hypot(x, y) > ROAD_WORLD_RADIUS_METERS + ROAD_TILE_SIZE_METERS) continue;
      keys.push(tileKeyFor(tx, ty));
    }
  }
  return { carTx, carTy, keys };
}

/**
 * updateRoadStreaming — recalcula la grilla 3×3 de tiles alrededor de la
 * posición actual del auto: carga los que faltan y descarga los que ya
 * quedaron fuera. Nunca pide nada más allá de ROAD_WORLD_RADIUS_METERS.
 */
function updateRoadStreaming(carLon, carLat){
  const { keys: neededKeys } = neededTileKeysAround(carLon, carLat);
  const neededSet = new Set(neededKeys);

  for (const key of neededKeys){
    if (roadTiles.has(key)) continue;
    const [tx, ty] = key.split("_").map(Number);
    roadTiles.set(key, { tx, ty, status: "queued", entities: [], roads: null });
    loadRoadTile(key); // en paralelo — cada tile es un solo fetch + una sola tanda de elevación
  }

  for (const key of Array.from(roadTiles.keys())){
    if (!neededSet.has(key)) unloadRoadTile(key);
  }

  updateHudStreamingStatus();
}

/**
 * startRoadStreaming — arranca el watcher periódico que sigue el TILE
 * actual del auto (no su posición exacta) y solo dispara
 * updateRoadStreaming cuando el auto cruzó a un tile distinto — mucho más
 * barato que reevaluar por distancia recorrida.
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
    const { tx, ty } = tileCoordsForLonLat(carLon, carLat);

    if (tx === lastStreamCarTx && ty === lastStreamCarTy) return;
    lastStreamCarTx = tx;
    lastStreamCarTy = ty;
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
 * generateInitialRoadPatch — carga SOLO el tile central (el que está bajo
 * el spawn) antes de ocultar la pantalla de carga, para que el auto
 * aparezca de inmediato con calle debajo. Los otros 8 tiles de la grilla
 * 3×3 se encolan pero se cargan en SEGUNDO PLANO, sin bloquear el arranque
 * — igual que ya hace updateRoadStreaming() cuando el auto se mueve.
 */
async function generateInitialRoadPatch(spawnLon, spawnLat){
  try {
    setLoadingStep("stepOsm", "active", "Cargando archivos locales de calles (sin llamadas a Overpass)…");

    const { carTx, carTy, keys: initialKeys } = neededTileKeysAround(spawnLon, spawnLat);
    lastStreamCarTx = carTx;
    lastStreamCarTy = carTy;

    const centerKey = tileKeyFor(carTx, carTy);
    const backgroundKeys = [];

    for (const key of initialKeys){
      const [tx, ty] = key.split("_").map(Number);
      roadTiles.set(key, { tx, ty, status: "queued", entities: [], roads: null });
      if (key !== centerKey) backgroundKeys.push(key);
    }

    // Solo se espera el tile central: es el único imprescindible para que
    // el auto no aparezca "flotando" sobre nada al arrancar.
    await loadRoadTile(centerKey);
    const centerTile = roadTiles.get(centerKey);
    const totalWays = centerTile?.roads?.length ?? 0;

    if (totalWays === 0) {
      console.warn(
        "[SantiagoGames] No se encontraron vías en data/tiles/ para esta zona. " +
        "¿Corriste `node scripts/fetch-roads.mjs` y pusheaste la carpeta data/tiles/? " +
        "Ver INSTRUCCIONES.md."
      );
    }

    markStepDone("stepOsm", `${totalWays} vías cargadas (tile central) — resto de la grilla 3×3 sigue en segundo plano.`);
    markStepDone("stepElevation", "Elevación real aplicada al tramo central.");
    markStepDone("stepMesh", `Malla procedural generada para ${totalWays} tramos.`);

    // El resto de la grilla (8 tiles) se genera después, sin bloquear:
    // no se espera este Promise.all antes de ocultar el loading.
    Promise.all(backgroundKeys.map((key) => loadRoadTile(key)))
      .then(() => updateHudStreamingStatus())
      .catch((err) => console.warn("Error cargando tiles de fondo de la grilla inicial:", err));

    startRoadStreaming();
  } catch (error) {
    // Un fallo puntual (p.ej. data/tiles/ no desplegado, o un problema de
    // red local) NO debe bloquear la simulación: se informa como error
    // real (no como "atascado") y el watcher se deja igual en marcha,
    // reintentará solo cuando el auto se mueva a un tile nuevo.
    console.error("Error generando el parche vial inicial:", error);
    setLoadingStep("stepOsm", "error", "No se pudo cargar el archivo local de calles (¿falta desplegar data/tiles/? ver consola).");
    startRoadStreaming();
  }
}

/**
/* ===================== SISTEMA DE CONDUCCIÓN (portado de GeoDrive) =====
   Física simplificada de vehículo terrestre — misma fórmula que usa
   GeoDrive para 'car' (updateCesiumCamera / rama ground-vehicle):
   acelerar/frenar con fricción cuando no hay input, radio de giro
   proporcional a la velocidad, y cámara en tercera persona persiguiendo
   al auto con lag independiente en heading (se abre en las curvas y
   alcanza de nuevo) y sin lag en la distancia (nunca se "cae" atrás a
   alta velocidad). Reemplaza el trackedEntity/orbit estático anterior:
   ahora el auto realmente se conduce con teclado/D-pad/pedales. */
const CAR = {
  accel: 15,          // km/h por segundo, pedal de gas
  brake: 25,          // km/h por segundo, pedal de freno
  friction: 4,         // km/h por segundo, desaceleración libre (sin input)
  maxSpeed: 130,        // km/h
  minSpeed: -30,         // km/h (reversa)
  baseTurnRate: 120,      // °/s a máxima deflexión de dirección
  steeringSensitivity: 1.0,
};

// Estado en vivo del auto (posición en grados, heading en grados, km/h).
const carState = { lat: SPAWN_LAT, lng: SPAWN_LON, heading: SPAWN_HEADING_DEG, speed: 0 };

// Input activo: gas/freno/izquierda/derecha, seteado por teclado y por los
// botones táctiles (D-pad + pedales) — ambos escriben al mismo objeto, así
// que funcionan indistintamente o combinados.
const driveInput = { forward: false, back: false, left: false, right: false };

let carAnimFrameId = null;
let carLastFrameTime = null;
let camSmoothHeadingRad = null; // heading suavizado de la cámara (lag en curvas)
const CAMERA_BACK_METERS = 9;   // distancia detrás del auto (no tiene lag: nunca se queda atrás)
const CAMERA_UP_METERS = 3.8;
const CAMERA_FOLLOW_DELAY = 1.0; // 1.0 = feel original de GeoDrive; >1 más lag, <1 más ágil

function bindDriveKey(key, prop){
  window.addEventListener("keydown", (e) => { if (e.key === key) driveInput[prop] = true; });
  window.addEventListener("keyup",   (e) => { if (e.key === key) driveInput[prop] = false; });
}
["ArrowUp", "w", "W"].forEach((k) => bindDriveKey(k, "forward"));
["ArrowDown", "s", "S"].forEach((k) => bindDriveKey(k, "back"));
["ArrowLeft", "a", "A"].forEach((k) => bindDriveKey(k, "left"));
["ArrowRight", "d", "D"].forEach((k) => bindDriveKey(k, "right"));

function bindDriveButton(el, prop){
  if (!el) return;
  const press = (e) => { e.preventDefault(); driveInput[prop] = true; el.classList.add("is-pressed"); };
  const release = (e) => { if (e) e.preventDefault(); driveInput[prop] = false; el.classList.remove("is-pressed"); };
  el.addEventListener("pointerdown", press);
  el.addEventListener("pointerup", release);
  el.addEventListener("pointerleave", release);
  el.addEventListener("pointercancel", release);
}
bindDriveButton(document.getElementById("btnGas"), "forward");
bindDriveButton(document.getElementById("btnBrake"), "back");
bindDriveButton(document.getElementById("btnLeft"), "left");
bindDriveButton(document.getElementById("btnRight"), "right");

const speedValueEl = document.getElementById("speedValue");

/**
 * updateCarPhysics — igual fórmula que GeoDrive para vehículos terrestres:
 * acelera/frena hacia maxSpeed/minSpeed con fricción libre cuando no hay
 * input, gira proporcional a la velocidad actual (parado no gira en el
 * lugar), y avanza en lat/lng según heading. dt en segundos.
 */
function updateCarPhysics(dt){
  if (driveInput.forward) carState.speed += CAR.accel * dt;
  else if (driveInput.back) carState.speed -= CAR.brake * dt;
  else {
    if (Math.abs(carState.speed) < CAR.friction * dt) carState.speed = 0;
    else carState.speed -= Math.sign(carState.speed) * CAR.friction * dt;
  }
  carState.speed = Math.max(CAR.minSpeed, Math.min(carState.speed, CAR.maxSpeed));

  const turnInput = driveInput.left ? -1 : driveInput.right ? 1 : 0;
  if (Math.abs(carState.speed) > 0.5){
    carState.heading += CAR.baseTurnRate * turnInput * CAR.steeringSensitivity * dt * Math.sign(carState.speed);
  }
  carState.heading = (carState.heading + 360) % 360;

  const hdgRad = Cesium.Math.toRadians(carState.heading);
  carState.lat += (carState.speed / 3.6 * Math.cos(hdgRad)) / 111320 * dt;
  carState.lng += (carState.speed / 3.6 * Math.sin(hdgRad)) / (111320 * Math.cos(Cesium.Math.toRadians(carState.lat))) * dt;
}

/**
 * updateCarEntityAndCamera — aplica carState al modelo 3D y mueve la
 * cámara en tercera persona persiguiendo al auto (mismo split-axis spring
 * que GeoDrive: la distancia detrás nunca tiene lag —se reconstruye desde
 * la posición real cada frame—, solo el heading se suaviza, así la cámara
 * se abre en las curvas y alcanza de nuevo en vez de rotar en seco).
 */
function updateCarEntityAndCamera(dt){
  if (!audiEntity || !viewer) return;

  const groundHeight = _lastCarGroundHeight ?? 0;
  const carPosition = Cesium.Cartesian3.fromDegrees(carState.lng, carState.lat, groundHeight);
  const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(carState.heading), 0, 0);
  audiEntity.position = carPosition;
  audiEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(carPosition, hpr);

  // Heading suavizado de la cámara (lag transversal — abre en curvas).
  const targetHeadingRad = Cesium.Math.toRadians(carState.heading);
  if (camSmoothHeadingRad === null){
    camSmoothHeadingRad = targetHeadingRad;
  } else {
    let diff = targetHeadingRad - camSmoothHeadingRad;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const headingAlpha = 1.0 - Math.exp(-(6 / CAMERA_FOLLOW_DELAY) * dt);
    camSmoothHeadingRad += diff * headingAlpha;
  }

  const vehicleTransform = Cesium.Transforms.headingPitchRollToFixedFrame(
    carPosition, new Cesium.HeadingPitchRoll(camSmoothHeadingRad, 0, 0)
  );
  const camOffset = new Cesium.Cartesian3(0, -CAMERA_BACK_METERS, CAMERA_UP_METERS);
  const camPos = Cesium.Matrix4.multiplyByPoint(vehicleTransform, camOffset, new Cesium.Cartesian3());

  // Apunta directo hacia el auto desde la posición de cámara calculada
  // (en vez de usar viewer.camera.lookAt, que deja la cámara "pegada" en
  // modo órbita) — así el drag/scroll del mouse para free-look sigue
  // disponible entre frames sin pelear con el chase cam.
  const toCar = Cesium.Cartesian3.subtract(carPosition, camPos, new Cesium.Cartesian3());
  const dist = Cesium.Cartesian3.magnitude(toCar);
  if (dist > 0.01){
    const dir = Cesium.Cartesian3.normalize(toCar, new Cesium.Cartesian3());
    const up = new Cesium.Cartesian3(0, 0, 1);
    viewer.camera.setView({ destination: camPos, orientation: { direction: dir, up } });
  }
}

let _lastCarGroundHeight = null;
let _carGroundSampleInFlight = false;

/**
 * sampleCarGroundHeight — re-muestrea la altura real del terreno bajo el
 * auto de forma periódica (no cada frame, es una llamada relativamente
 * cara) para que el auto se mantenga apoyado en el suelo/rampas mientras
 * se conduce, igual que hace GeoDrive con su plano de referencia.
 */
async function sampleCarGroundHeight(){
  if (_carGroundSampleInFlight || !viewer) return;
  _carGroundSampleInFlight = true;
  try {
    const carto = Cesium.Cartographic.fromDegrees(carState.lng, carState.lat);
    const sampled = await sampleHeightMostDetailedSafe(carto ? [carto] : []);
    if (sampled && sampled[0] && isFinite(sampled[0].height)){
      _lastCarGroundHeight = sampled[0].height;
    }
  } catch (e) { /* sin conexión momentánea, se reintenta en el próximo ciclo */ }
  _carGroundSampleInFlight = false;
}

function carAnimationLoop(timestampMs){
  if (carLastFrameTime === null) carLastFrameTime = timestampMs;
  const dt = Math.min(0.1, (timestampMs - carLastFrameTime) / 1000); // clamp: evita saltos si la pestaña estuvo en background
  carLastFrameTime = timestampMs;

  updateCarPhysics(dt);
  updateCarEntityAndCamera(dt);
  updateNavMap();
  if (speedValueEl) speedValueEl.textContent = Math.round(Math.abs(carState.speed));

  carAnimFrameId = requestAnimationFrame(carAnimationLoop);
}

function startCarLoop(){
  if (carAnimFrameId !== null) return;
  carLastFrameTime = null;
  carAnimFrameId = requestAnimationFrame(carAnimationLoop);
  if (_carGroundSampleTimerId === null){
    _carGroundSampleTimerId = setInterval(sampleCarGroundHeight, 400);
  }
}
let _carGroundSampleTimerId = null;

function stopCarLoop(){
  if (carAnimFrameId !== null){
    cancelAnimationFrame(carAnimFrameId);
    carAnimFrameId = null;
  }
  if (_carGroundSampleTimerId !== null){
    clearInterval(_carGroundSampleTimerId);
    _carGroundSampleTimerId = null;
  }
}

/**
 * spawnAudiQuattro — coloca el Audi Quattro en el punto de spawn fijo
 * (SPAWN_LON, SPAWN_LAT) orientado a SPAWN_HEADING_DEG (330–335°, NNO),
 * arranca la física de conducción y deja la cámara en tercera persona
 * detrás del auto, sin importar qué juego se haya seleccionado en el
 * selector.
 */
async function spawnAudiQuattro(){
  setLoadingStep("stepSpawn", "active", "Posicionando el Audi Quattro…");

  // Muestrea la altura real del terreno/edificios de los 3D Tiles en el
  // punto de spawn, para que el auto quede apoyado en el suelo y no
  // flotando o enterrado.
  const carto = Cesium.Cartographic.fromDegrees(SPAWN_LON, SPAWN_LAT);
  let groundHeight = 0;
  const sampled = await sampleHeightMostDetailedSafe([carto]);
  if (sampled && sampled[0] && isFinite(sampled[0].height)) {
    groundHeight = sampled[0].height;
  } else {
    console.warn("No se pudo muestrear la altura del terreno en el spawn, usando 0.");
  }
  _lastCarGroundHeight = groundHeight;

  carState.lat = SPAWN_LAT;
  carState.lng = SPAWN_LON;
  carState.heading = SPAWN_HEADING_DEG;
  carState.speed = 0;
  camSmoothHeadingRad = null;

  const carPosition = Cesium.Cartesian3.fromDegrees(SPAWN_LON, SPAWN_LAT, groundHeight);
  const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(SPAWN_HEADING_DEG), 0, 0);
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(carPosition, hpr);

  if (audiEntity) {
    viewer.entities.remove(audiEntity);
  }
  // La cámara maneja manualmente (chase cam propia) — no usamos
  // viewer.trackedEntity, así el input de conducción no compite con el
  // control orbital nativo de Cesium.
  viewer.trackedEntity = undefined;

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

  updateCarEntityAndCamera(0);
  if (!navMap) initNavMap();
  startCarLoop();

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
  stopCarLoop();
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
  tileset.dynamicScreenSpaceError = gdSettings.dynamicScreenSpaceError;
  tileset.dynamicScreenSpaceErrorDensity = gdSettings.dynamicScreenSpaceErrorDensity;
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
const dynamicSseToggle = document.getElementById("dynamicSseToggle");
const dynamicSseDensitySlider = document.getElementById("dynamicSseDensitySlider");
const dynamicSseDensityValue = document.getElementById("dynamicSseDensityValue");
const dynamicSseDensityRow = document.getElementById("dynamicSseDensityRow");

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

/**
 * Dynamic Screen Space Error — mismo mecanismo de GeoDrive: cuando está
 * activo, Cesium reduce automáticamente el detalle exigido a los 3D Tiles
 * a medida que se alejan de cámara (sin tocar la calidad cerca del auto),
 * aliviando GPU/CPU. La densidad controla qué tan agresiva es esa caída.
 */
dynamicSseToggle.addEventListener("change", () => {
  gdSettings.dynamicScreenSpaceError = dynamicSseToggle.checked;
  dynamicSseDensityRow.classList.toggle("is-disabled", !dynamicSseToggle.checked);
  dynamicSseDensitySlider.disabled = !dynamicSseToggle.checked;
  applyGdOptimizations();
});

dynamicSseDensitySlider.addEventListener("input", () => {
  gdSettings.dynamicScreenSpaceErrorDensity = Number(dynamicSseDensitySlider.value);
  dynamicSseDensityValue.textContent = dynamicSseDensitySlider.value;
  applyGdOptimizations();
});

/* ============================== ARRANQUE ============================== */
// Marcador de versión: si en la consola del navegador NO ves este mensaje,
// el navegador/GitHub Pages está sirviendo un script.js viejo en caché —
// hacé un hard refresh (o recarga forzada) antes de reportar cualquier
// bug de carga/streaming.
/* ===================== NAVEGACIÓN: BUSCADOR + MINIMAPA (GeoDrive) =====
   Portado de #gps-search / #gps-minimap-* de GeoDrive: geocodificación
   con Nominatim (OpenStreetMap), minimapa Leaflet en modo "head-up"
   (rota con el heading del auto, la flecha del auto queda fija mirando
   arriba), con distancia en línea recta al destino, arrastre del panel,
   redimensionado libre y minimizado — mismos mecanismos, estilo dorado/
   negro en vez del azul/verde original. */
let navMap = null;
let navMapDestMarker = null;
let navMapCurrentZoom = 15;
let navDestLatLng = null; // {lat, lng, label} o null si no hay destino
let _navMapLastTick = 0;

function initNavMap(){
  const container = document.getElementById("navMinimap");
  if (!container || typeof L === "undefined") return;

  navMap = L.map("navMinimap", {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    touchZoom: false,
    doubleClickZoom: false,
    keyboard: false,
    zoomSnap: 0,
    zoomAnimation: false,
    trackResize: false,
    attributionControl: false,
  }).setView([carState.lat, carState.lng], navMapCurrentZoom);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 22 }
  ).addTo(navMap);

  requestAnimationFrame(() => { if (navMap) navMap.invalidateSize(false); });
}

/** Llamado desde el loop del auto — internamente throttleado a ~10 fps. */
function updateNavMap(){
  if (!navMap) return;
  const now = performance.now();
  if (now - _navMapLastTick < 100) return;
  _navMapLastTick = now;

  navMap.setView([carState.lat, carState.lng], navMapCurrentZoom, { animate: false });

  // Rotación head-up: el mapa gira con el heading, la flecha del auto
  // queda fija apuntando siempre hacia arriba del overlay.
  const el = document.getElementById("navMinimap");
  if (el) el.style.transform = `rotate(${-carState.heading}deg)`;

  const distEl = document.getElementById("navMinimapDistWrap");
  if (navDestLatLng){
    if (!navMapDestMarker){
      navMapDestMarker = L.marker([navDestLatLng.lat, navDestLatLng.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:13px;height:13px;background:#E8B93A;border:2.5px solid #121210;border-radius:50%;box-shadow:0 0 8px rgba(232,185,58,0.85);"></div>`,
          iconSize: [13, 13], iconAnchor: [6, 6],
        }),
        zIndexOffset: 500,
      }).addTo(navMap);
    } else {
      navMapDestMarker.setLatLng([navDestLatLng.lat, navDestLatLng.lng]);
    }
    const d = greatCircleDistanceKm(carState.lat, carState.lng, navDestLatLng.lat, navDestLatLng.lng);
    if (distEl) distEl.textContent = d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  } else if (navMapDestMarker){
    navMap.removeLayer(navMapDestMarker);
    navMapDestMarker = null;
    if (distEl) distEl.textContent = "—";
  }
}

function greatCircleDistanceKm(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = Cesium.Math.toRadians(lat2 - lat1);
  const dLon = Cesium.Math.toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(Cesium.Math.toRadians(lat1)) * Math.cos(Cesium.Math.toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function setNavDestination(lat, lng, label){
  navDestLatLng = { lat, lng, label: label || null };
  const destLabelEl = document.getElementById("navMinimapDestLabel");
  if (destLabelEl) destLabelEl.textContent = "📍 " + (label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
}

async function searchNavLocation(){
  const input = document.getElementById("navSearchInput");
  const q = input && input.value.trim();
  if (!q) return;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data && data.length > 0){
      setNavDestination(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name || q);
    } else {
      const destLabelEl = document.getElementById("navMinimapDestLabel");
      if (destLabelEl) destLabelEl.textContent = "Sin resultados para \"" + q + "\"";
    }
  } catch (e) {
    console.warn("Búsqueda de dirección falló (sin conexión a Nominatim):", e);
  }
}

const navSearchBtn = document.getElementById("navSearchBtn");
const navSearchInput = document.getElementById("navSearchInput");
if (navSearchBtn) navSearchBtn.addEventListener("click", searchNavLocation);
if (navSearchInput) navSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchNavLocation();
});

const navZoomInBtn = document.getElementById("navZoomIn");
const navZoomOutBtn = document.getElementById("navZoomOut");
function navMapZoom(delta){
  navMapCurrentZoom = Math.min(19, Math.max(10, navMapCurrentZoom + delta));
  if (navMap) navMap.setView([carState.lat, carState.lng], navMapCurrentZoom, { animate: false });
}
if (navZoomInBtn) navZoomInBtn.addEventListener("click", () => navMapZoom(1));
if (navZoomOutBtn) navZoomOutBtn.addEventListener("click", () => navMapZoom(-1));

/* ---- Minimizar (colapsa a solo el header, igual que GeoDrive) ---- */
(function setupNavMinimapMinimize(){
  const overlay = document.getElementById("navMinimapOverlay");
  const minBtn = document.getElementById("navMinimapBtnMin");
  if (!overlay || !minBtn) return;
  let minimized = false;
  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    minimized = !minimized;
    overlay.classList.toggle("is-minimized", minimized);
    minBtn.textContent = minimized ? "▢" : "–";
    if (!minimized && navMap) requestAnimationFrame(() => navMap.invalidateSize(false));
  });
})();

/* ---- Arrastre del panel (agarrando el header) ---- */
(function setupNavMinimapDrag(){
  const overlay = document.getElementById("navMinimapOverlay");
  const header = document.getElementById("navMinimapHeader");
  if (!overlay || !header) return;
  let dragging = false, offsetX = 0, offsetY = 0;

  header.addEventListener("pointerdown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    dragging = true;
    const r = overlay.getBoundingClientRect();
    offsetX = e.clientX - r.left;
    offsetY = e.clientY - r.top;
    try { header.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  header.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    let x = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - offsetX));
    let y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offsetY));
    overlay.style.left = x + "px";
    overlay.style.top = y + "px";
    overlay.style.right = "auto";
  });
  ["pointerup", "pointercancel"].forEach((ev) =>
    header.addEventListener(ev, () => { dragging = false; }));
})();

/* ---- Redimensionado libre (arrastrando la esquina) ---- */
(function setupNavMinimapResize(){
  const handle = document.getElementById("navMinimapResizeHandle");
  const overlay = document.getElementById("navMinimapOverlay");
  const viewport = document.getElementById("navMinimapViewport");
  const mapEl = document.getElementById("navMinimap");
  if (!handle || !overlay || !viewport || !mapEl) return;

  const BASE_W = 240, BASE_H = 190;
  const BASE_MAP_W = 360, BASE_MAP_H = 360;
  const MIN_W = 150, MAX_W = 560;
  let resizing = false, startX = 0, startY = 0, startW = BASE_W;

  function applySize(w){
    w = Math.max(MIN_W, Math.min(MAX_W, w));
    const h = w * (BASE_H / BASE_W);
    overlay.style.width = w + "px";
    viewport.style.width = w + "px";
    viewport.style.height = h + "px";
    const mapW = w * (BASE_MAP_W / BASE_W);
    const mapH = h * (BASE_MAP_H / BASE_H);
    mapEl.style.width = mapW + "px";
    mapEl.style.height = mapH + "px";
    mapEl.style.left = ((w - mapW) / 2) + "px";
    mapEl.style.top = ((h - mapH) / 2) + "px";
    if (navMap) navMap.invalidateSize(false);
  }

  handle.addEventListener("pointerdown", (e) => {
    resizing = true;
    startX = e.clientX; startY = e.clientY;
    startW = overlay.getBoundingClientRect().width;
    handle.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  });
  handle.addEventListener("pointermove", (e) => {
    if (!resizing) return;
    const delta = (e.clientX - startX) + (e.clientY - startY);
    applySize(startW + delta / 2);
  });
  ["pointerup", "pointercancel"].forEach((ev) =>
    handle.addEventListener(ev, () => { resizing = false; }));
})();

console.log("[SantiagoGames] script.js — streaming de calles v2 (consulta única + progreso continuo)");

// Al cargar la página SIEMPRE se ve primero el selector.
// La simulación queda oculta (`hidden`) y su inicialización de Cesium
// solo ocurre dentro de initSimulation(), llamada exclusivamente desde
// el click en "Seleccionar".
buildCards();
render();
