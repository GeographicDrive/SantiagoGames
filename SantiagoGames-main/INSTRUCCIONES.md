# Calles precomputadas (ya no Overpass en vivo)

La app ya NO consulta Overpass API mientras se juega. Las calles de los
45 km de mundo se descargan **una sola vez, offline**, con un script de
Node, y quedan como archivos JSON estáticos en `data/tiles/`. En runtime,
el streaming de 300 m alrededor del auto solo hace `fetch()` de esos
archivos locales (rápido, sin límites de tasa, sin bloquear la UI).

## Por qué tenés que correrlo vos

El script necesita salir a internet a `overpass-api.de`, y el entorno
donde generé este proyecto tiene la red restringida a un allowlist de
dominios que no incluye Overpass — por eso no pude generarlos yo mismo.
Es un paso único que tenés que correr en tu máquina (o en un GitHub
Action con acceso a internet) antes de desplegar.

## Cómo generarlos

Requisitos: Node.js 18 o superior (usa `fetch` nativo, sin dependencias).

```bash
node scripts/fetch-roads.mjs
```

Por defecto usa el mismo centro, radio (45 km) y tamaño de tile (2 km)
que espera `script.js`. Tarda bastante: cubre el círculo de 45 km con
tiles de 2 km, son cientos de consultas a Overpass, una a la vez con
pausa entre cada una (para no abusar del servidor público). Podés
cortarlo (Ctrl+C) y volver a correrlo después: los tiles ya escritos en
disco se saltan automáticamente (usá `--force` si querés rehacer todo).

Opciones útiles:

```bash
# Tiles más chicos (más archivos, cada uno más liviano)
node scripts/fetch-roads.mjs --tile-size 1000

# Probar con un radio chico primero, antes de ir por los 45 km completos
node scripts/fetch-roads.mjs --radius 5000

# Reintentar solo un par de tiles puntuales (debug)
node scripts/fetch-roads.mjs --only -3,5 -2,5

# Re-descargar todo aunque ya existan los archivos
node scripts/fetch-roads.mjs --force
```

Al terminar vas a tener:

```
data/
  tiles/
    -12_4.json
    -12_5.json
    ...
    index.json      (lista de tiles generados)
  meta.json          (parámetros usados en la corrida)
```

## Velocidad (paralelo por defecto)

El script ya reparte las consultas **en paralelo entre varios mirrors**
de Overpass (uno por worker), en vez de mandarlas todas en fila a un solo
servidor. Esto no cambia el resultado (mismos tiles, mismas calles, mismo
dedupe) — solo lo hace bastante más rápido, y como cada worker le pega a
un mirror distinto, no sobrecarga más a ninguno individualmente.

```bash
# Por defecto: un worker por mirror conocido (3), corriendo en paralelo
node scripts/fetch-roads.mjs --radius 45000

# Más mirrors / más workers en paralelo (más rápido, pero más agresivo)
node scripts/fetch-roads.mjs --radius 45000 \
  --endpoints "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.openstreetmap.fr/api/interpreter" \
  --concurrency 3

# Volver al modo secuencial de antes (1 a la vez)
node scripts/fetch-roads.mjs --radius 45000 --concurrency 1
```

Si algunos tiles fallan (mirror caído, timeout, etc.), al final del log
vas a ver la lista de los que quedaron pendientes. **Simplemente corré el
mismo comando de nuevo** — los tiles ya generados se saltan automáticamente
y solo se reintentan los que faltan. Podés repetir esto las veces que
haga falta hasta que la corrida termine con 0 fallos.

## Si Overpass responde 406 / rechaza la conexión

El servidor público principal a veces es exigente con los headers o
bloquea según el entorno (por ejemplo, en Termux). El script ya manda
`User-Agent` y el body en el formato oficial (`data=` urlencoded), pero
si el error persiste, probá con un mirror alternativo:

```bash
node scripts/fetch-roads.mjs --radius 5000 --endpoint https://overpass.kumi.systems/api/interpreter
```

Otros mirrors conocidos: `https://overpass.openstreetmap.ru/api/interpreter`,
`https://overpass.private.coffee/api/interpreter`. Si uno da 406/429/50x
de forma persistente, probá con otro.

## Antes de pushear

**IMPORTANTE:** `data/tiles/` normalmente no está en `.gitignore`, pero
si tu repo tiene alguna regla que ignore `data/` o `*.json`, revisala —
sin esos archivos en el repo, la app no tiene calles que mostrar (no se
rompe ni se cuelga, pero vas a ver "0 vías cargadas" en el log de la
consola y el mundo va a estar vacío).

Si `--tile-size` genera demasiados archivos chicos o el repo queda muy
pesado, subí `--tile-size` (menos tiles, cada uno más grande) y volvé a
correr con `--force`.

## Si cambiás el centro/radio del mundo

`CENTER_LON`, `CENTER_LAT`, `RADIUS_METERS` (mundo) y
`ROAD_TILE_SIZE_METERS` en `script.js` deben coincidir con
`--center-lon`, `--center-lat`, `--radius` y `--tile-size` del script.
Si cambiás uno, cambiá el otro y volvé a generar los tiles.
