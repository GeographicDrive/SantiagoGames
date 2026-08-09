# Detección de calles: por visión de color (sin descargas)

Este proyecto **ya no depende de ningún dato vial precomputado**. La
versión anterior descargaba las calles de OpenStreetMap vía Overpass API
(`scripts/fetch-roads.mjs`) y las guardaba como archivos estáticos en
`data/tiles/`. Ese pipeline completo se eliminó — no hay ningún script que
correr ni ningún archivo que generar/subir antes de desplegar.

## Cómo funciona ahora

El auto "mira" directamente lo que Cesium ya está renderizando (los 3D
Tiles fotorrealistas) y clasifica el color de cada punto que le interesa
como calle o no-calle:

- **Asfalto/concreto** → gris, poco saturado, brillo medio → se clasifica
  como calle.
- **Pasto, tejas, autos, piletas, etc.** → colores más vivos/saturados o
  fuera del rango de brillo esperado → no-calle.

Esto vive en `script.js`, sección **"VISIÓN DE CALLE POR COLOR"**:

- `isWorldPointStreet(x, y)` — clasifica un punto puntual (calle / no
  calle / sin dato si queda fuera de cámara).
- `findNearestStreetByColor(carX, carY)` — barrido tipo sensores en
  anillos crecientes alrededor del auto, usado por el autopilot para saber
  hacia dónde corregir el heading.
- `updateStreetRepulsion(dt)` — el autopilot en sí (gira `carState.heading`
  hacia la calle detectada, nunca teletransporta la posición).

## Limitaciones a tener en cuenta

Es un heurístico de visión, no una fuente de verdad exacta como sería un
mapa vectorial real:

- Solo puede clasificar puntos que la cámara YA está viendo (si un punto
  queda detrás de la cámara o fuera del viewport, se trata como "sin
  dato", nunca se inventa una clasificación).
- Superficies grises que no son calle (techos de zinc, concreto de
  veredas/patios) pueden confundirse con asfalto, y asfalto muy claro
  (líneas de pintura vial al sol) o muy oscuro (sombra dura) puede quedar
  fuera del rango de brillo esperado. Los umbrales están en las constantes
  `STREET_VISION_MAX_SATURATION` / `STREET_VISION_MIN_BRIGHTNESS` /
  `STREET_VISION_MAX_BRIGHTNESS`, ajustables si hace falta afinar la
  detección para una zona en particular.
- No hay noción de "ancho real de la calle" ni de "carril/tangente" como
  sí tenía el sistema OSM anterior: el autopilot solo dirige el heading
  hacia el punto de calle más cercano encontrado, sin el afinado de
  "seguir el carril".

## Modo debug

En Configuración → "Repulsión debug" se puede activar un overlay en el
minimapa que pinta en rojo cada celda que la visión por color NO clasifica
como calle, más una línea en el HUD (`-STREET, NOT REPULSION-` /
`-NOT STREET, REPULSION-`) que muestra en vivo qué está "viendo" el
autopilot bajo el auto.
