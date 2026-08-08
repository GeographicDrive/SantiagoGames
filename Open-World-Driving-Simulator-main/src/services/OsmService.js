/**
 * OsmService - Handles Nominatim geocoding and Overpass road data retrieval
 */
export class OsmService {
  constructor() {
    this.nominatimUrl = 'https://nominatim.openstreetmap.org/search';
    this.overpassUrl = 'https://overpass-api.de/api/interpreter';
  }

  /**
   * Geocodes a location query to latitude & longitude
   * @param {string} query 
   * @returns {Promise<Array>} List of matches [{name, lat, lon, type}]
   */
  async searchLocation(query) {
    try {
      const url = `${this.nominatimUrl}?format=json&q=${encodeURIComponent(query)}&limit=5`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'VibeDrive-Simulator/1.0' // OpenStreetMap requests user-agent
        }
      });
      
      if (!response.ok) throw new Error('Geocoding service unavailable');
      
      const data = await response.json();
      return data.map(item => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type || item.class || 'location'
      }));
    } catch (e) {
      console.warn('Geocoding error:', e);
      return [];
    }
  }

  /**
   * Fetches road segments near a coordinate and stitches them into a continuous path
   * @param {number} lat 
   * @param {number} lon 
   * @returns {Promise<Object>} Path data with coordinates in meters relative to start node
   */
  async fetchRoadPath(lat, lon) {
    // Overpass query for roads in a 1500m radius
    const query = `[out:json][timeout:15];
      way(around:1500, ${lat}, ${lon})[highway~"motorway|trunk|primary|secondary|tertiary|unclassified|residential"];
      (._;>;);
      out body;`;

    try {
      const response = await fetch(this.overpassUrl, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) throw new Error('Overpass API returned error');

      const data = await response.json();
      if (!data.elements || data.elements.length === 0) {
        throw new Error('No roads found in this area');
      }

      // 1. Index nodes by ID
      const nodes = {};
      const ways = [];

      data.elements.forEach(el => {
        if (el.type === 'node') {
          nodes[el.id] = { lat: el.lat, lon: el.lon };
        } else if (el.type === 'way' && el.nodes && el.nodes.length >= 2) {
          ways.push({
            id: el.id,
            nodes: el.nodes,
            name: el.tags ? el.tags.name || el.tags.ref || 'Unnamed Road' : 'Road'
          });
        }
      });

      if (ways.length === 0) {
        throw new Error('No valid road segments found');
      }

      // 2. Stitch ways together to form the longest continuous path
      const stitchedPath = this.stitchWays(ways, nodes);
      if (stitchedPath.length < 5) {
        throw new Error('Stitched road path is too short');
      }

      // 3. Project to 3D Cartesian coordinates (Mercator relative to starting node)
      const startNode = stitchedPath[0];
      const lat0 = startNode.lat;
      const lon0 = startNode.lon;

      // Earth radius approximation for meter projections
      const latScale = 110574; // meters per degree latitude
      const lonScale = 111320 * Math.cos(lat0 * Math.PI / 180); // meters per degree longitude

      const points = stitchedPath.map(node => {
        const x = (node.lon - lon0) * lonScale;
        const z = -(node.lat - lat0) * latScale; // -Z is forward in WebGL
        return { x, z, lat: node.lat, lon: node.lon };
      });

      // Find the name of the main road we stitched
      const roadName = ways.find(w => w.nodes.includes(startNode.id))?.name || 'Scenic Route';

      return {
        success: true,
        name: roadName,
        points: points,
        lat: lat0,
        lon: lon0
      };
    } catch (e) {
      console.warn('Overpass API error, falling back to procedural generation:', e);
      return {
        success: false,
        name: 'Procedural Scenic Drive',
        points: this.generateProceduralPath(),
        lat: lat,
        lon: lon
      };
    }
  }

  /**
   * Stitches disjointed OSM ways using a greedy endpoint-matching algorithm
   */
  stitchWays(ways, nodes) {
    // Copy ways to allow modification
    const remainingWays = [...ways];
    
    // Sort by node count descending, and start with the longest way
    remainingWays.sort((a, b) => b.nodes.length - a.nodes.length);
    const activeWay = remainingWays.shift();
    
    let pathNodeIds = [...activeWay.nodes];
    let stitchedCount = 1;
    let searching = true;

    // Stitch iteratively
    while (searching && remainingWays.length > 0) {
      searching = false;
      const startId = pathNodeIds[0];
      const endId = pathNodeIds[pathNodeIds.length - 1];

      for (let i = 0; i < remainingWays.length; i++) {
        const way = remainingWays[i];
        const wStart = way.nodes[0];
        const wEnd = way.nodes[way.nodes.length - 1];

        if (wStart === endId) {
          pathNodeIds.push(...way.nodes.slice(1));
          remainingWays.splice(i, 1);
          searching = true;
          stitchedCount++;
          break;
        } else if (wEnd === startId) {
          pathNodeIds.unshift(...way.nodes.slice(0, -1));
          remainingWays.splice(i, 1);
          searching = true;
          stitchedCount++;
          break;
        } else if (wEnd === endId) {
          // Reverse way and append
          const reversed = [...way.nodes].reverse();
          pathNodeIds.push(...reversed.slice(1));
          remainingWays.splice(i, 1);
          searching = true;
          stitchedCount++;
          break;
        } else if (wStart === startId) {
          // Reverse way and prepend
          const reversed = [...way.nodes].reverse();
          pathNodeIds.unshift(...reversed.slice(0, -1));
          remainingWays.splice(i, 1);
          searching = true;
          stitchedCount++;
          break;
        }
      }
    }

    console.log(`Stitched ${stitchedCount} OSM segments. Path contains ${pathNodeIds.length} nodes.`);

    // Convert node IDs to coordinates
    return pathNodeIds
      .map(id => nodes[id])
      .filter(node => node !== undefined);
  }

  /**
   * Generates a beautiful procedural winding road path when OSM requests fail
   */
  generateProceduralPath() {
    const points = [];
    const numPoints = 150;
    const spacing = 45; // meters between nodes
    
    let x = 0;
    let z = 0;
    let angle = 0;

    points.push({ x, z });

    for (let i = 1; i < numPoints; i++) {
      // Create interesting sweeps, S-curves and straightaways
      const phase = i / 10;
      const turnIntensity = Math.sin(phase * 0.4) * Math.cos(phase * 0.1);
      angle += turnIntensity * 0.18; // Gradual turning angle
      
      x += Math.sin(angle) * spacing;
      z -= Math.cos(angle) * spacing; // Moving forward (negative Z)
      
      points.push({ x, z });
    }

    return points;
  }
}
