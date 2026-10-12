// Shared projection factory used by both the browser renderer and the Node build scripts.
// Keep this file dependency-light (d3-geo only) and free of TypeScript syntax.
import { geoConicConformal } from 'd3-geo';

/**
 * @param {{parallels:number[], rotate:number[], fitExtent:{west:number,east:number,south:number,north:number}, worldWidth:number, worldHeight:number}} cfg
 */
export function makeProjection(cfg) {
  const { west, east, south, north } = cfg.fitExtent;
  const ring = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) ring.push([west + ((east - west) * i) / steps, south]);
  for (let i = 0; i <= steps; i++) ring.push([east, south + ((north - south) * i) / steps]);
  for (let i = steps; i >= 0; i--) ring.push([west + ((east - west) * i) / steps, north]);
  for (let i = steps; i >= 0; i--) ring.push([west, south + ((north - south) * i) / steps]);
  const outline = { type: 'MultiPoint', coordinates: ring };
  return geoConicConformal()
    .parallels(cfg.parallels)
    .rotate(cfg.rotate)
    .precision(0.2)
    .fitExtent([[0, 0], [cfg.worldWidth, cfg.worldHeight]], outline);
}
