import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Robust utility to safely merge BufferGeometries with mismatched attributes,
 * index/non-index presence, or missing UV/normals.
 */
export function safeMergeBufferGeometries(
  geometries: (THREE.BufferGeometry | null | undefined)[],
  useGroups = false
): THREE.BufferGeometry | null {
  const validGeos = geometries.filter((g): g is THREE.BufferGeometry => g !== null && g !== undefined);
  if (validGeos.length === 0) return null;
  if (validGeos.length === 1) return validGeos[0].clone();

  const normalized: THREE.BufferGeometry[] = [];
  for (let i = 0; i < validGeos.length; i++) {
    const orig = validGeos[i];

    // Convert all to non-indexed so all geometries share identical format and layout
    const g = orig.index ? orig.toNonIndexed() : orig.clone();

    // Ensure normal attribute exists
    if (!g.attributes.normal) {
      g.computeVertexNormals();
    }

    // Ensure uv attribute exists
    if (!g.attributes.uv && g.attributes.position) {
      const posCount = g.attributes.position.count;
      const uvs = new Float32Array(posCount * 2);
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }

    // Strip any non-standard mismatched attributes, keeping position, normal, uv, color
    // (and aBodyPart if present across crowd geometry)
    const clean = new THREE.BufferGeometry();
    clean.setAttribute('position', g.attributes.position);
    if (g.attributes.normal) clean.setAttribute('normal', g.attributes.normal);
    if (g.attributes.uv) clean.setAttribute('uv', g.attributes.uv);
    if (g.attributes.color) clean.setAttribute('color', g.attributes.color);
    if (g.attributes.aBodyPart) clean.setAttribute('aBodyPart', g.attributes.aBodyPart);

    normalized.push(clean);
  }

  try {
    const merged = BufferGeometryUtils.mergeGeometries(normalized, useGroups);
    // Dispose intermediate normalized geometries
    for (let i = 0; i < normalized.length; i++) {
      normalized[i].dispose();
    }
    return merged;
  } catch (err) {
    console.warn('safeMergeBufferGeometries fallback failed:', err);
    for (let i = 0; i < normalized.length; i++) {
      normalized[i].dispose();
    }
    return null;
  }
}

/**
 * Merges geometries safely and disposes the input geometries.
 */
export function safeMergeAndDispose(
  geometries: (THREE.BufferGeometry | null | undefined)[],
  useGroups = false
): THREE.BufferGeometry | null {
  const merged = safeMergeBufferGeometries(geometries, useGroups);
  for (let i = 0; i < geometries.length; i++) {
    const g = geometries[i];
    if (g) g.dispose();
  }
  return merged;
}
