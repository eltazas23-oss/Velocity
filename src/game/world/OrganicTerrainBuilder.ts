/**
 * OrganicTerrainBuilder.ts - High-Fidelity Sculpted Topography & Natural Terrain Engine
 * 
 * Features:
 * - Natural continuous topography with gentle rolling berms (clear driver line-of-sight to the horizon)
 * - Seamless foothills rise at outer perimeter connecting directly with the mountain ring
 * - High-Definition 1024x1024 PBR Competition Turf Textures (Albedo, Sobel Normal & Roughness)
 * - Authentic European Championship Racing Turf Palette (Silverstone, Spa-Francorchamps, Monza)
 * - Exact sRGB color space calibration and high-frequency micro-blade detail to prevent distance blur
 */

import * as THREE from 'three';

export interface TerrainElevationConfig {
  minDistanceToTrack?: (x: number, z: number) => number;
  trackBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export class OrganicTerrainBuilder {
  private static cachedTextures: {
    albedo: THREE.CanvasTexture;
    normal: THREE.CanvasTexture;
    roughness: THREE.CanvasTexture;
  } | null = null;

  /**
   * Generates a high-definition 1024x1024 PBR competition grass texture suite (Albedo, Normal, Roughness)
   * with multi-octave organic fractal noise, rich chlorophyll undertones, and macro-contrast patches.
   */
  public static createOrganicGrassPBRTextures(): {
    albedo: THREE.CanvasTexture;
    normal: THREE.CanvasTexture;
    roughness: THREE.CanvasTexture;
  } {
    if (this.cachedTextures) {
      return this.cachedTextures;
    }

    const size = 1024;
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d')!;

    const nCanvas = document.createElement('canvas');
    nCanvas.width = size;
    nCanvas.height = size;
    const nCtx = nCanvas.getContext('2d')!;

    const rCanvas = document.createElement('canvas');
    rCanvas.width = size;
    rCanvas.height = size;
    const rCtx = rCanvas.getContext('2d')!;

    // Seamless value noise permutation table
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      perm[i] = perm[i + 256] = Math.floor(Math.random() * 256);
    }
    const gradX = [-1, 1, 0, 0, 1, -1, 1, -1];
    const gradY = [0, 0, -1, 1, 1, 1, -1, -1];

    const periodicNoise = (x: number, y: number, period: number): number => {
      const px = Math.floor(x) % period;
      const py = Math.floor(y) % period;
      const px1 = (px + 1) % period;
      const py1 = (py + 1) % period;

      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);
      const u = xf * xf * (3.0 - 2.0 * xf);
      const v = yf * yf * (3.0 - 2.0 * yf);

      const g00 = perm[px + perm[py]] % 8;
      const g10 = perm[px1 + perm[py]] % 8;
      const g01 = perm[px + perm[py1]] % 8;
      const g11 = perm[px1 + perm[py1]] % 8;

      const d00 = gradX[g00] * xf + gradY[g00] * yf;
      const d10 = gradX[g10] * (xf - 1) + gradY[g10] * yf;
      const d01 = gradX[g01] * xf + gradY[g01] * (yf - 1);
      const d11 = gradX[g11] * (xf - 1) + gradY[g11] * (yf - 1);

      const x1 = d00 * (1 - u) + d10 * u;
      const x2 = d01 * (1 - u) + d11 * u;
      return x1 * (1 - v) + x2 * v;
    };

    const heightField = new Float32Array(size * size);
    const albedoImg = aCtx.createImageData(size, size);
    const roughImg = rCtx.createImageData(size, size);
    const ad = albedoImg.data;
    const rd = roughImg.data;

    for (let y = 0; y < size; y++) {
      const ny = y / size;
      for (let x = 0; x < size; x++) {
        const nx = x / size;

        // 5-octave fractal noise with macro landscape patches and micro-blade definition
        const o1 = periodicNoise(nx * 4, ny * 4, 4);     // Macro grass health & soil moisture (scale: ~20m)
        const o2 = periodicNoise(nx * 12, ny * 12, 12);   // Mid turf mower bands & aeration
        const o3 = periodicNoise(nx * 32, ny * 32, 32);   // Blade tuft clusters
        const o4 = periodicNoise(nx * 80, ny * 80, 80);   // Individual blade stippling
        const o5 = periodicNoise(nx * 160, ny * 160, 160); // Fine chlorophyll texture

        const h = o1 * 0.40 + o2 * 0.28 + o3 * 0.18 + o4 * 0.10 + o5 * 0.04;
        heightField[y * size + x] = h;

        const normH = Math.min(1.0, Math.max(0.0, (h + 0.85) / 1.7));
        const macroPatch = Math.min(1.0, Math.max(0.0, (o1 + 0.85) / 1.7));
        const mowerBand = Math.sin(ny * Math.PI * 24.0) * 0.08;

        // Authentic European Grand Prix Turf Palette (Silverstone, Spa, Red Bull Ring)
        // Base dark loam humus: rgb(24, 46, 18)
        // Mid lush competition green: rgb(48, 98, 34)
        // Vibrant sunlit chlorophyll crown: rgb(72, 142, 48)
        // Golden dry tip highlights: rgb(98, 162, 58)
        let r = 26 + normH * 46 + macroPatch * 22 + mowerBand * 12;
        let g = 52 + normH * 90 + macroPatch * 36 + mowerBand * 20;
        let b = 20 + normH * 32 + macroPatch * 16 + mowerBand * 8;

        // Micro-blade organic stippling
        const bladeJitter = (Math.random() - 0.5) * 8;
        r = Math.min(255, Math.max(0, Math.floor(r + bladeJitter * 0.4)));
        g = Math.min(255, Math.max(0, Math.floor(g + bladeJitter * 0.8)));
        b = Math.min(255, Math.max(0, Math.floor(b + bladeJitter * 0.3)));

        const idx = (y * size + x) * 4;
        ad[idx] = r;
        ad[idx + 1] = g;
        ad[idx + 2] = b;
        ad[idx + 3] = 255;

        // Organic velvety roughness (0.78 to 0.92)
        const roughVal = Math.floor((0.80 + (1.0 - normH) * 0.12 + (Math.random() - 0.5) * 0.04) * 255);
        rd[idx] = roughVal;
        rd[idx + 1] = roughVal;
        rd[idx + 2] = roughVal;
        rd[idx + 3] = 255;
      }
    }

    aCtx.putImageData(albedoImg, 0, 0);
    rCtx.putImageData(roughImg, 0, 0);

    // High-precision Sobel Normal Filter (diffuses 5.8-intensity sun glare naturally)
    const normalImg = nCtx.createImageData(size, size);
    const nd = normalImg.data;
    const normalStrength = 2.8;

    for (let y = 0; y < size; y++) {
      const yPrev = (y - 1 + size) % size;
      const yNext = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xPrev = (x - 1 + size) % size;
        const xNext = (x + 1) % size;

        const hL = heightField[y * size + xPrev];
        const hR = heightField[y * size + xNext];
        const hU = heightField[yPrev * size + x];
        const hD = heightField[yNext * size + x];

        const dx = (hR - hL) * normalStrength;
        const dy = (hD - hU) * normalStrength;
        const len = Math.sqrt(dx * dx + dy * dy + 1.0);

        const nx = -dx / len;
        const ny = -dy / len;
        const nz = 1.0 / len;

        const idx = (y * size + x) * 4;
        nd[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        nd[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        nd[idx + 2] = Math.floor(nz * 255);
        nd[idx + 3] = 255;
      }
    }
    nCtx.putImageData(normalImg, 0, 0);

    // Color space and mipmap setup
    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.repeat.set(100, 100);
    albedoTex.anisotropy = 4;
    albedoTex.colorSpace = THREE.SRGBColorSpace; // CRITICAL: authentic sRGB gamma decoding!
    albedoTex.generateMipmaps = true;

    const normalTex = new THREE.CanvasTexture(nCanvas);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(100, 100);
    normalTex.anisotropy = 2;
    normalTex.generateMipmaps = true;

    const roughTex = new THREE.CanvasTexture(rCanvas);
    roughTex.wrapS = THREE.RepeatWrapping;
    roughTex.wrapT = THREE.RepeatWrapping;
    roughTex.repeat.set(100, 100);
    roughTex.anisotropy = 2;
    roughTex.generateMipmaps = true;

    this.cachedTextures = { albedo: albedoTex, normal: normalTex, roughness: roughTex };
    return this.cachedTextures;
  }

  public static createOrganicGrassTexture(): THREE.CanvasTexture {
    return this.createOrganicGrassPBRTextures().albedo;
  }

  /**
   * Constructs organic undulating terrain with gentle natural verge slopes
   * (preserves full cockpit visibility towards the mountain skyline).
   */
  public static buildSculptedTerrain(
    width: number,
    depth: number,
    segmentsX: number,
    segmentsZ: number,
    grassMaterial: THREE.Material,
    getDistanceToTrack?: (x: number, z: number) => number,
    center: { x: number; z: number } = { x: 0, z: 0 }
  ): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + center.x;
      const z = pos.getZ(i) + center.z;

      const dist = getDistanceToTrack ? getDistanceToTrack(x, z) : Math.hypot(x, z);

      let elevation = -0.05;

      if (dist > 18.0) {
        // Gentle safety margin rise near track (reaches only ~1.2m at 50m distance)
        const trackMarginT = Math.min(1.0, (dist - 18.0) / 45.0);
        const vergeHeight = trackMarginT * 0.95;

        // Subtle, smooth rolling countryside berms (1.0m to 2.2m amplitude)
        const wave1 = Math.sin(x * 0.014 + 0.4) * Math.cos(z * 0.016 + 0.8) * 1.5;
        const wave2 = Math.sin((x + z) * 0.026 + 1.1) * 0.75;
        const rollingBerms = (wave1 + wave2) * trackMarginT;

        // Smooth foothills rise at outer perimeter (r > 300m) to meet mountain backdrop
        const rFromCenter = Math.hypot(x, z);
        const outerFoothillT = Math.max(0.0, (rFromCenter - 290.0) / 100.0);
        const foothillRise = Math.pow(outerFoothillT, 2.0) * 12.5;

        elevation = -0.05 + vergeHeight + rollingBerms + foothillRise;
      }

      pos.setY(i, elevation);
    }

    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, grassMaterial);
    mesh.position.set(center.x, 0, center.z);
    mesh.receiveShadow = true;
    return mesh;
  }
}
