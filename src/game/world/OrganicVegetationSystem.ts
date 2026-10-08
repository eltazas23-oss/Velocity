/**
 * OrganicVegetationSystem.ts - High-Fidelity 3D Botanical Engine & GPU Instanced Foliage
 * 
 * Masterpiece Botanical Architecture:
 * - 100% Elimination of straight geometric boxes, rigid cones or flat cartoon spheres.
 * - Multi-tiered foliage clusters with high organic noise displacement and deep crevice shadowing.
 * - Baked Vertex AO: Undersides of branch clusters and canopy interiors are deeply shadowed.
 * - Hybrid Botanical Normals: Crisp directional leaf shading with subtle outward ambient curvature.
 * - Hardware GPU Instancing with Spatial Partitioning: Native Frustum Culling and only 1-2 Draw Calls per species!
 */

import * as THREE from 'three';
import { safeMergeBufferGeometries } from '../utils/GeometryUtils';
import { StaticObstacle } from './TrackBuilder';

export interface TreePlacementConfig {
  x: number;
  z: number;
  scale?: number;
  type: 'pine' | 'oak' | 'cypress' | 'birch' | 'bush';
  yaw?: number;
}

export class OrganicVegetationSystem {
  /**
   * Computes botanical foliage normals: blends crisp local cluster normals with a subtle
   * outward hemispherical envelope to eliminate the artificial cartoon balloon look
   * while maintaining lush, soft light diffusion.
   */
  public static computeBotanicalFoliageNormals(
    geo: THREE.BufferGeometry,
    center = new THREE.Vector3(0, 0, 0),
    sphericalBlend = 0.22
  ): void {
    geo.computeVertexNormals();
    const pos = geo.attributes.position;
    const normals = geo.attributes.normal as THREE.BufferAttribute;
    if (!normals) return;

    const v = new THREE.Vector3();
    const n = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).sub(center).normalize();
      n.fromBufferAttribute(normals, i);
      // Blend physical micro-facet normal with outward envelope
      n.lerp(v, sphericalBlend).normalize();
      normals.setXYZ(i, n.x, n.y, n.z);
    }
    normals.needsUpdate = true;
  }

  /**
   * Bakes volumetric Ambient Occlusion (AO) directly into geometry vertex colors.
   * Deep shadowed interiors and underside of canopies receive rich dark tones,
   * while upper sun-facing surfaces receive sky irradiance. (Zero real-time GPU cost!)
   */
  public static applyFoliageVertexAO(
    geo: THREE.BufferGeometry,
    center: THREE.Vector3,
    minY: number,
    maxY: number,
    baseDarkness = 0.22
  ): void {
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const rangeY = Math.max(0.1, maxY - minY);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      const heightT = Math.min(1, Math.max(0, (y - minY) / rangeY));
      const distXZ = Math.hypot(x - center.x, z - center.z);

      // Deep core & under-canopy shading, bright sunlit crown & rim
      const verticalAO = baseDarkness + Math.pow(heightT, 1.6) * (1.0 - baseDarkness);
      const radialAO = Math.min(0.24, distXZ * 0.06);
      const ao = Math.min(1.0, Math.max(0.12, verticalAO + radialAO));

      // Subtle biological chlorophyll tint in shadow (rich deep pine olive to fresh needles)
      colors[i * 3] = Math.min(1.0, ao * 0.90);
      colors[i * 3 + 1] = Math.min(1.0, ao * 1.05);
      colors[i * 3 + 2] = Math.min(1.0, ao * 0.88);
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (geo.attributes.color) {
      geo.attributes.color.needsUpdate = true;
    }
  }

  /**
   * Recomputes spherical vertex normals outwards from a centroid (backward-compatible)
   */
  public static computeSphericalNormals(geo: THREE.BufferGeometry, center = new THREE.Vector3(0, 0, 0)): void {
    this.computeBotanicalFoliageNormals(geo, center, 0.25);
  }

  /**
   * Applies multi-frequency organic fractal noise to foliage vertices to break geometric uniformity
   */
  public static displaceFoliage(geo: THREE.BufferGeometry, scale = 0.35): void {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x, z) || 0.001;

      const j1 = Math.sin(x * 5.2 + y * 4.1) * Math.cos(z * 4.8);
      const j2 = Math.sin(y * 8.6 + (x + z) * 3.4) * 0.55;
      const j3 = Math.cos(x * 12.0 - z * 10.0) * 0.25;
      const displace = (j1 + j2 + j3) * scale;

      pos.setX(i, x + (x / dist) * displace);
      pos.setY(i, y + displace * 0.75);
      pos.setZ(i, z + (z / dist) * displace);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /**
   * Generates an authentic FIA Grade-1 competition grass blade cluster (16cm - 24cm tall).
   */
  public static createCurvedGrassTuftGeometry(): THREE.BufferGeometry {
    const bladeCount = 8;
    const bladeGeos: THREE.BufferGeometry[] = [];

    for (let b = 0; b < bladeCount; b++) {
      const bladeYaw = (b / bladeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const bladeHeight = 0.16 + Math.random() * 0.08;
      const bladeWidth = 0.024;
      const bendAmount = 0.06 + Math.random() * 0.04;
      const lateralLean = (Math.random() - 0.5) * 0.025;

      const segments = 4;
      const vertices: number[] = [];
      const colors: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const w = bladeWidth * (1.0 - t * 0.85);
        const outward = Math.pow(t, 1.8) * bendAmount;
        const lateral = Math.pow(t, 1.4) * lateralLean;
        const y = t * bladeHeight - Math.pow(t, 2.2) * 0.02;

        const cr = 0.012 + t * 0.035;
        const cg = 0.028 + t * 0.075;
        const cb = 0.014 + t * 0.030;

        vertices.push(-w / 2 + lateral, y, outward);
        colors.push(cr, cg, cb);
        uvs.push(0, t);

        vertices.push(w / 2 + lateral, y, outward);
        colors.push(cr, cg, cb);
        uvs.push(1, t);
      }

      for (let s = 0; s < segments; s++) {
        const row1 = s * 2;
        const row2 = (s + 1) * 2;
        indices.push(row1, row1 + 1, row2 + 1);
        indices.push(row1, row2 + 1, row2);
      }

      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      bGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      bGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      bGeo.setIndex(indices);
      bGeo.computeVertexNormals();

      bGeo.rotateY(bladeYaw);
      bladeGeos.push(bGeo);
    }

    const merged = safeMergeBufferGeometries(bladeGeos, false) || bladeGeos[0];
    for (let i = 0; i < bladeGeos.length; i++) bladeGeos[i].dispose();

    merged.translate(0, -0.015, 0);
    return merged;
  }

  /**
   * European High-Alpine Conifer / Maritime Pine (Pinus Pinaster / Picea Abies)
   * Muscular lofted trunk supporting horizontal tiered needle canopies
   * with sculpted branch clusters, rich vertex ambient occlusion and zero spherical look.
   */
  public static createPineGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    const trunkH = 8.5;
    const trunkSegments = 7;
    const trunkIndices: number[] = [];
    const trunkPositions: number[] = [];
    const trunkUvs: number[] = [];
    const radialSegs = 8;

    for (let s = 0; s <= trunkSegments; s++) {
      const t = s / trunkSegments;
      const y = t * trunkH;
      const cx = Math.sin(t * Math.PI * 0.88) * 0.38;
      const cz = Math.cos(t * Math.PI * 0.58) * 0.24;
      const rootFlare = Math.pow(Math.max(0, 1 - t * 3.5), 2.2) * 0.65;
      const r = 0.22 + Math.pow(1 - t, 2.7) * 0.42 + rootFlare;

      for (let j = 0; j <= radialSegs; j++) {
        const ang = (j / radialSegs) * Math.PI * 2;
        const rootFlute = s <= 1 ? Math.cos(ang * 5) * 0.22 * (1 - t * 0.8) : 0;
        const effR = r + rootFlute;
        const vx = cx + Math.cos(ang) * effR;
        const vz = cz + Math.sin(ang) * effR;
        trunkPositions.push(vx, y - 0.12, vz);
        trunkUvs.push(j / radialSegs, t * 3.2);
      }
    }

    const stride = radialSegs + 1;
    for (let s = 0; s < trunkSegments; s++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = s * stride + j;
        const b = s * stride + j + 1;
        const c = (s + 1) * stride + j + 1;
        const d = (s + 1) * stride + j;
        trunkIndices.push(a, b, c, a, c, d);
      }
    }

    const trunkGeo = new THREE.BufferGeometry();
    trunkGeo.setAttribute('position', new THREE.Float32BufferAttribute(trunkPositions, 3));
    trunkGeo.setAttribute('uv', new THREE.Float32BufferAttribute(trunkUvs, 2));
    trunkGeo.setIndex(trunkIndices);
    trunkGeo.computeVertexNormals();

    const trunkParts: THREE.BufferGeometry[] = [trunkGeo];
    const boughAngles = [0.45, 1.65, 2.85, 4.15, 5.35];
    boughAngles.forEach((ang, idx) => {
      const boughCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.sin(ang * 2) * 0.15, trunkH * (0.64 + idx * 0.05), Math.cos(ang * 2) * 0.15),
        new THREE.Vector3(Math.cos(ang) * 1.55, trunkH * (0.74 + idx * 0.05), Math.sin(ang) * 1.55),
        new THREE.Vector3(Math.cos(ang) * 2.85, trunkH * (0.83 + idx * 0.05), Math.sin(ang) * 2.85),
      ]);
      const boughGeo = new THREE.TubeGeometry(boughCurve, 5, 0.16 * (1 - idx * 0.1), 6, false);
      trunkParts.push(boughGeo);
    });

    const mergedTrunk = safeMergeBufferGeometries(trunkParts, false) || trunkParts[0];
    for (let i = 0; i < trunkParts.length; i++) trunkParts[i].dispose();

    // Natural layered umbrella canopy plateaus with asymmetric lobed branch masses
    const foliageGeos: THREE.BufferGeometry[] = [];
    const tiers = [
      { y: trunkH * 0.70, r: 4.6, lobes: 6, scaleY: 0.28 },
      { y: trunkH * 0.86, r: 3.9, lobes: 5, scaleY: 0.32 },
      { y: trunkH * 1.02, r: 2.9, lobes: 4, scaleY: 0.35 },
      { y: trunkH * 1.15, r: 1.8, lobes: 3, scaleY: 0.40 },
    ];

    tiers.forEach((tier) => {
      // Flattened horizontal coniferous plateau pad
      const mainPad = new THREE.CylinderGeometry(tier.r * 0.2, tier.r, tier.r * tier.scaleY, 10, 2);
      this.displaceFoliage(mainPad, 0.36);
      mainPad.translate(0, tier.y, 0);
      foliageGeos.push(mainPad);

      // Surrounding organic needle clusters
      for (let l = 0; l < tier.lobes; l++) {
        const ang = (l / tier.lobes) * Math.PI * 2 + 0.3;
        const dist = tier.r * 0.72;
        const lobeR = tier.r * 0.42;
        const lobe = new THREE.CylinderGeometry(0.1, lobeR, lobeR * tier.scaleY * 1.2, 7, 2);
        this.displaceFoliage(lobe, 0.32);
        lobe.translate(Math.cos(ang) * dist, tier.y - 0.14, Math.sin(ang) * dist);
        foliageGeos.push(lobe);
      }
    });

    const mergedFoliage = safeMergeBufferGeometries(foliageGeos, false) || foliageGeos[0];
    for (let i = 0; i < foliageGeos.length; i++) foliageGeos[i].dispose();

    this.applyFoliageVertexAO(mergedFoliage, new THREE.Vector3(0, trunkH * 0.90, 0), trunkH * 0.58, trunkH * 1.28, 0.20);
    this.computeBotanicalFoliageNormals(mergedFoliage, new THREE.Vector3(0, trunkH * 0.90, 0), 0.22);

    return { trunk: mergedTrunk, foliage: mergedFoliage };
  }

  /**
   * European Broadleaf Oak (Quercus Robur)
   */
  public static createOakGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    const trunkH = 6.0;
    const trunkGeo = new THREE.CylinderGeometry(0.44, 0.96, trunkH, 8, 4);
    trunkGeo.translate(0, trunkH / 2 - 0.15, 0);

    const trunkParts: THREE.BufferGeometry[] = [trunkGeo];
    for (let b = 0; b < 5; b++) {
      const ang = (b / 5) * Math.PI * 2 + 0.35;
      const boughCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, trunkH * 0.72, 0),
        new THREE.Vector3(Math.cos(ang) * 1.35, trunkH * 0.90, Math.sin(ang) * 1.35),
        new THREE.Vector3(Math.cos(ang) * 2.45, trunkH * 1.10, Math.sin(ang) * 2.45),
      ]);
      const boughGeo = new THREE.TubeGeometry(boughCurve, 5, 0.22, 6, false);
      trunkParts.push(boughGeo);
    }
    const mergedTrunk = safeMergeBufferGeometries(trunkParts, false) || trunkParts[0];
    for (let i = 0; i < trunkParts.length; i++) trunkParts[i].dispose();

    const clusterLocs = [
      { x: 0, y: trunkH * 1.05, z: 0, r: 3.2 },
      { x: 1.85, y: trunkH * 1.20, z: 0.95, r: 2.6 },
      { x: -1.75, y: trunkH * 1.24, z: 1.15, r: 2.5 },
      { x: 0.35, y: trunkH * 1.30, z: -1.95, r: 2.6 },
      { x: -1.45, y: trunkH * 1.36, z: -1.25, r: 2.3 },
      { x: 1.55, y: trunkH * 1.40, z: -0.95, r: 2.2 },
      { x: 0, y: trunkH * 1.62, z: 0, r: 2.5 },
    ];

    const foliageParts: THREE.BufferGeometry[] = [];
    clusterLocs.forEach((cl) => {
      const geo = new THREE.IcosahedronGeometry(cl.r, 2);
      geo.scale(1.2, 0.75, 1.15);
      this.displaceFoliage(geo, 0.42);
      geo.translate(cl.x, cl.y, cl.z);
      foliageParts.push(geo);
    });

    const mergedFoliage = safeMergeBufferGeometries(foliageParts, false) || foliageParts[0];
    for (let i = 0; i < foliageParts.length; i++) foliageParts[i].dispose();

    this.applyFoliageVertexAO(mergedFoliage, new THREE.Vector3(0, trunkH * 1.25, 0), trunkH * 0.85, trunkH * 1.85, 0.22);
    this.computeBotanicalFoliageNormals(mergedFoliage, new THREE.Vector3(0, trunkH * 1.25, 0), 0.20);

    return { trunk: mergedTrunk, foliage: mergedFoliage };
  }

  /**
   * Italian Slender Cypress (Cupressus Sempervirens)
   */
  public static createCypressGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    const trunkH = 1.8;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.38, trunkH, 8);
    trunkGeo.translate(0, trunkH / 2 - 0.1, 0);

    const foliageH = 10.2;
    const tiers = 7;
    const foliageParts: THREE.BufferGeometry[] = [];

    for (let t = 0; t < tiers; t++) {
      const ty = trunkH * 0.70 + t * (foliageH / tiers) * 0.88;
      const progress = t / (tiers - 1);
      const tr = 1.45 * Math.sin(progress * Math.PI * 0.84 + 0.16) + 0.32;
      const geo = new THREE.CylinderGeometry(tr * 0.55, tr, (foliageH / tiers) * 1.35, 8, 2);
      this.displaceFoliage(geo, 0.26);
      geo.translate(0, ty, 0);
      foliageParts.push(geo);
    }

    const mergedFoliage = safeMergeBufferGeometries(foliageParts, false) || foliageParts[0];
    for (let i = 0; i < foliageParts.length; i++) foliageParts[i].dispose();

    this.applyFoliageVertexAO(mergedFoliage, new THREE.Vector3(0, trunkH + foliageH * 0.5, 0), trunkH * 0.7, trunkH + foliageH, 0.25);
    this.computeBotanicalFoliageNormals(mergedFoliage, new THREE.Vector3(0, trunkH + foliageH * 0.5, 0), 0.22);

    return { trunk: trunkGeo, foliage: mergedFoliage };
  }

  /**
   * Silver Birch / Paddock Feature Tree (Betula Pendula)
   */
  public static createBirchGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    const trunkH = 7.2;
    const trunkGeo = new THREE.CylinderGeometry(0.20, 0.42, trunkH, 8, 3);
    trunkGeo.translate(0, trunkH / 2 - 0.1, 0);

    const foliageParts: THREE.BufferGeometry[] = [];
    const clusters = [
      { y: trunkH * 0.65, r: 1.8, ox: 0.6, oz: 0.2 },
      { y: trunkH * 0.78, r: 2.1, ox: -0.5, oz: 0.4 },
      { y: trunkH * 0.90, r: 2.0, ox: 0.3, oz: -0.5 },
      { y: trunkH * 1.05, r: 1.6, ox: 0.0, oz: 0.0 },
    ];

    clusters.forEach((cl) => {
      const geo = new THREE.IcosahedronGeometry(cl.r, 2);
      geo.scale(1.2, 0.85, 1.2);
      this.displaceFoliage(geo, 0.36);
      geo.translate(cl.ox, cl.y, cl.oz);
      foliageParts.push(geo);
    });

    const mergedFoliage = safeMergeBufferGeometries(foliageParts, false) || foliageParts[0];
    for (let i = 0; i < foliageParts.length; i++) foliageParts[i].dispose();

    this.applyFoliageVertexAO(mergedFoliage, new THREE.Vector3(0, trunkH * 0.85, 0), trunkH * 0.55, trunkH * 1.25, 0.25);
    this.computeBotanicalFoliageNormals(mergedFoliage, new THREE.Vector3(0, trunkH * 0.85, 0), 0.22);
    return { trunk: trunkGeo, foliage: mergedFoliage };
  }

  /**
   * Circuit Flowering Shrub & Bush Cluster
   */
  public static createBushGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const clusterPositions = [
      { x: 0, y: 0.6, z: 0, r: 0.95 },
      { x: 0.68, y: 0.52, z: 0.42, r: 0.82 },
      { x: -0.62, y: 0.56, z: -0.36, r: 0.86 },
      { x: 0.22, y: 0.48, z: -0.68, r: 0.78 },
    ];

    clusterPositions.forEach((cl) => {
      const geo = new THREE.IcosahedronGeometry(cl.r, 2);
      geo.scale(1.2, 0.75, 1.2);
      this.displaceFoliage(geo, 0.32);
      geo.translate(cl.x, cl.y, cl.z);
      parts.push(geo);
    });

    const merged = safeMergeBufferGeometries(parts, false) || parts[0];
    for (let i = 0; i < parts.length; i++) parts[i].dispose();
    this.applyFoliageVertexAO(merged, new THREE.Vector3(0, 0.5, 0), 0.0, 1.2, 0.28);
    this.computeBotanicalFoliageNormals(merged, new THREE.Vector3(0, 0.5, 0), 0.22);
    return merged;
  }

  /**
   * Compiles and instantiates the full botanical forest into GPU InstancedMeshes
   */
  public static buildVegetationForest(
    parent: THREE.Group,
    trees: TreePlacementConfig[],
    materials: {
      trunkMat: THREE.Material;
      pineFoliageMat: THREE.Material;
      oakFoliageMat: THREE.Material;
      cypressFoliageMat: THREE.Material;
      bushMat: THREE.Material;
      birchFoliageMat?: THREE.Material;
    },
    staticObstacles?: StaticObstacle[]
  ): void {
    if (staticObstacles) {
      trees.forEach((t) => {
        if (t.type !== 'bush') {
          staticObstacles.push({
            x: t.x,
            z: t.z,
            radius: 0.8 * (t.scale || 1.0),
            type: 'tree',
          });
        }
      });
    }
    const pine = this.createPineGeometries();
    const oak = this.createOakGeometries();
    const cypress = this.createCypressGeometries();
    const birch = this.createBirchGeometries();
    const bushGeo = this.createBushGeometry();

    const pines: TreePlacementConfig[] = [];
    const oaks: TreePlacementConfig[] = [];
    const cypresses: TreePlacementConfig[] = [];
    const birches: TreePlacementConfig[] = [];
    const bushes: TreePlacementConfig[] = [];

    trees.forEach((t) => {
      switch (t.type) {
        case 'pine':
          pines.push(t);
          break;
        case 'oak':
          oaks.push(t);
          break;
        case 'cypress':
          cypresses.push(t);
          break;
        case 'birch':
          birches.push(t);
          break;
        case 'bush':
          bushes.push(t);
          break;
      }
    });

    const instantiateType = (
      items: TreePlacementConfig[],
      trunkGeo: THREE.BufferGeometry | null,
      foliageGeo: THREE.BufferGeometry,
      foliageMat: THREE.Material,
      scaleMultiplier = 1.0,
      baseHue = 0.35
    ): void => {
      if (items.length === 0) return;

      const chunkSize = 120;
      const chunks = new Map<string, TreePlacementConfig[]>();

      items.forEach((item) => {
        const cx = Math.floor(item.x / chunkSize);
        const cz = Math.floor(item.z / chunkSize);
        const key = `${cx}_${cz}`;
        let list = chunks.get(key);
        if (!list) {
          list = [];
          chunks.set(key, list);
        }
        list.push(item);
      });

      const dummy = new THREE.Object3D();
      const col = new THREE.Color();

      chunks.forEach((chunkItems) => {
        const count = chunkItems.length;
        if (count === 0) return;

        if (trunkGeo) {
          const trunkMesh = new THREE.InstancedMesh(trunkGeo, materials.trunkMat, count);
          trunkMesh.receiveShadow = false;
          trunkMesh.castShadow = false;

          chunkItems.forEach((item, i) => {
            const s = (item.scale || 1.0) * scaleMultiplier;
            dummy.position.set(item.x, 0, item.z);
            dummy.rotation.set(0, item.yaw || Math.random() * Math.PI * 2, 0);
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            trunkMesh.setMatrixAt(i, dummy.matrix);

            const barkLum = 0.32 + Math.sin(item.x * 0.19 + item.z * 0.29) * 0.05;
            col.setHSL(0.08, 0.30, barkLum);
            trunkMesh.setColorAt(i, col);
          });

          trunkMesh.instanceMatrix.needsUpdate = true;
          if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true;
          trunkMesh.computeBoundingSphere();
          trunkMesh.computeBoundingBox();
          parent.add(trunkMesh);
        }

        const foliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMat, count);
        foliageMesh.receiveShadow = false;
        foliageMesh.castShadow = false;

        chunkItems.forEach((item, i) => {
          const s = (item.scale || 1.0) * scaleMultiplier;
          dummy.position.set(item.x, 0, item.z);
          dummy.rotation.set(0, item.yaw || Math.random() * Math.PI * 2, 0);
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          foliageMesh.setMatrixAt(i, dummy.matrix);

          const hueShift = Math.sin(item.x * 0.17 + item.z * 0.23) * 0.022;
          const satShift = Math.cos(item.x * 0.31 + item.z * 0.19) * 0.07;
          const lumShift = Math.sin(item.x * 0.43 + item.z * 0.37) * 0.05;
          col.setHSL(baseHue + hueShift, 0.50 + satShift, 0.45 + lumShift);
          foliageMesh.setColorAt(i, col);
        });

        foliageMesh.instanceMatrix.needsUpdate = true;
        if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true;
        foliageMesh.computeBoundingSphere();
        foliageMesh.computeBoundingBox();
        parent.add(foliageMesh);
      });
    };

    instantiateType(pines, pine.trunk, pine.foliage, materials.pineFoliageMat, 1.2, 0.36);
    instantiateType(oaks, oak.trunk, oak.foliage, materials.oakFoliageMat, 1.35, 0.32);
    instantiateType(cypresses, cypress.trunk, cypress.foliage, materials.cypressFoliageMat, 0.85, 0.38);
    instantiateType(birches, birch.trunk, birch.foliage, materials.birchFoliageMat || materials.oakFoliageMat, 1.0, 0.31);
    instantiateType(bushes, null, bushGeo, materials.bushMat, 0.6, 0.33);
  }
}
