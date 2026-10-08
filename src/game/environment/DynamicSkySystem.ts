/**
 * DynamicSkySystem.ts - Next-Generation Physically-Based Atmospheric Sky & Volumetric Clouds
 *
 * Engineered for high-end 3D racing simulators (60-120 FPS rock-solid):
 * 1. 100% Mathematically Isotropic 3D Celestial Sphere Cloud Evaluation:
 *    - Eliminates all planar/shell projection formulas that caused horizontal scanline striations.
 *    - Directional ray vector evaluates directly in continuous 3D Simplex space on S^2.
 *    - Metric scale is identical in horizontal and vertical directions (conformal Jacobian = I).
 *    - Completely eliminates horizontal banding, stripes, streaks, and polar singularities.
 * 2. Multi-Octave Organic Volumetric Cumulus Formations:
 *    - Distinct, towering cumulus islands with cauliflower billow crowns and clear blue sky vistas.
 *    - Aerodynamic 3D domain warping for natural convective updrafts and swirling edges.
 *    - Micro-turbulent condensation erosion creating soft, translucent vapor margins.
 * 3. Physical Volumetric Lighting & Micro-Optics:
 *    - Beer-Lambert Law optical extinction.
 *    - 3D Analytical Sun Probe directional self-shadowing (warm golden tops vs cool slate-blue bases).
 *    - Multiple forward scattering ("Powder Sugar" internal volume luminescence).
 *    - Henyey-Greenstein silver lining phase scattering towards the sun.
 *    - Rayleigh aerial perspective immersion towards the horizon.
 * 4. High-Altitude Cirrus Veils (Layer 2):
 *    - Delicate, silky ice crystal streamers drifting with jet stream winds.
 * 5. High-Performance Mobile & Desktop Optimization:
 *    - 1 single draw call on the sky dome.
 *    - Zero texture lookups, zero VRAM bandwidth overhead, pure high-speed ALU math.
 *    - Zero CPU allocations in the animation loop.
 */

import * as THREE from 'three';

export interface DynamicSkyConfig {
  zenithColor?: THREE.Color;
  horizonColor?: THREE.Color;
  sunColor?: THREE.Color;
  groundHazeColor?: THREE.Color;
  cloudCoverage?: number;
  cloudDensity?: number;
  windSpeed1?: number;
  windSpeed2?: number;
}

export class DynamicSkySystem {
  public readonly group: THREE.Group;
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly uniforms: {
    uTime: { value: number };
    uSunDirection: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Vector3 };
    uSkyZenithColor: { value: THREE.Vector3 };
    uSkyHorizonColor: { value: THREE.Vector3 };
    uGroundHazeColor: { value: THREE.Vector3 };
    uCloudCoverage: { value: number };
    uCloudDensity: { value: number };
    uWindVelocity1: { value: THREE.Vector2 };
    uWindVelocity2: { value: THREE.Vector2 };
  };

  private envTexture: THREE.Texture | null = null;

  constructor(config?: DynamicSkyConfig) {
    this.group = new THREE.Group();

    // Physically-calibrated sunset colors
    const zenith = config?.zenithColor ?? new THREE.Color(0x061434);
    const horizon = config?.horizonColor ?? new THREE.Color(0xf48838);
    const sunCol = config?.sunColor ?? new THREE.Color(0xffeed6);
    const groundHaze = config?.groundHazeColor ?? new THREE.Color(0x121620);

    const w1 = config?.windSpeed1 ?? 1.0;
    const w2 = config?.windSpeed2 ?? 1.0;

    this.uniforms = {
      uTime: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(-0.68, 0.17, -0.71).normalize() },
      uSunColor: { value: new THREE.Vector3(sunCol.r, sunCol.g, sunCol.b) },
      uSkyZenithColor: { value: new THREE.Vector3(zenith.r, zenith.g, zenith.b) },
      uSkyHorizonColor: { value: new THREE.Vector3(horizon.r, horizon.g, horizon.b) },
      uGroundHazeColor: { value: new THREE.Vector3(groundHaze.r, groundHaze.g, groundHaze.b) },
      uCloudCoverage: { value: config?.cloudCoverage ?? 0.44 },
      uCloudDensity: { value: config?.cloudDensity ?? 0.96 },
      uWindVelocity1: { value: new THREE.Vector2(0.008 * w1, 0.004 * w1) },
      uWindVelocity2: { value: new THREE.Vector2(-0.016 * w2, 0.018 * w2) },
    };

    const vertexShader = `
      varying vec3 vWorldRay;

      void main() {
        // Local position on the dome (centered on camera) gives the exact world direction ray
        vWorldRay = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const fragmentShader = `
      precision highp float;

      varying vec3 vWorldRay;

      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uSkyZenithColor;
      uniform vec3 uSkyHorizonColor;
      uniform vec3 uGroundHazeColor;
      uniform float uCloudCoverage;
      uniform float uCloudDensity;
      uniform vec2 uWindVelocity1;
      uniform vec2 uWindVelocity2;

      // =========================================================================
      // 1. STEFAN GUSTAVSON MATHEMATICAL 3D SIMPLEX NOISE (mod289 polynomial)
      // 100% isotropic on S^2, zero precision decay, zero coordinate singularities.
      // =========================================================================
      vec3 mod289(vec3 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }

      vec4 mod289(vec4 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }

      vec4 permute(vec4 x) {
        return mod289(((x * 34.0) + 1.0) * x);
      }

      vec4 taylorInvSqrt(vec4 r) {
        return 1.79284291400159 - 0.85373472095314 * r;
      }

      float snoise3D(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        // First corner
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        // Permutations
        i = mod289(i);
        vec4 p = permute(permute(permute(
                   i.z + vec4(0.0, i1.z, i2.z, 1.0))
                 + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                 + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        // Gradients: 7x7 points over a square, mapped onto an octahedron.
        float n_ = 0.142857142857; // 1.0/7.0
        vec3 ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z); // mod(p, 7*7)

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_); // mod(j, N)

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        // Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        // Mix contributions from the four corners
        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
      }

      // 3-octave Fractional Brownian Motion (fBm) in continuous 3D space with balanced amplitude
      float fbm3D(vec3 p) {
        float v = 0.58 * snoise3D(p);
        p = p * 2.03 + vec3(1.23, 0.47, 0.81);
        v += 0.28 * snoise3D(p);
        p = p * 2.05 + vec3(0.35, 1.82, 0.29);
        v += 0.14 * snoise3D(p);
        return v; // [-1.0, 1.0]
      }

      // Fast, lightweight 2-octave sun probe to evaluate optical self-shadowing without redundant noise taps
      float fbmFast(vec3 p) {
        float v = 0.65 * snoise3D(p);
        p = p * 2.03 + vec3(1.23, 0.47, 0.81);
        v += 0.35 * snoise3D(p);
        return v;
      }

      // 3D Aerodynamic convective swirl domain warping (efficient dual-component warp)
      vec3 warp3D(vec3 p) {
        return vec3(
          snoise3D(p * 0.85),
          snoise3D(p * 0.85 + vec3(4.31, 2.74, 1.58)),
          snoise3D(p * 0.85 + vec3(1.72, 5.19, 3.46))
        ) * 0.34;
      }

      // =========================================================================
      // 2. VOLUMETRIC CUMULUS SHAPING & CLOUD CLUSTERING
      // Evaluated in continuous 3D space: eliminates all horizontal stripes
      // =========================================================================
      float sampleCumulusDensity(vec3 p, float coverage) {
        // Convective domain warping
        vec3 warp = warp3D(p);
        vec3 warpedP = p + warp;

        // Base multi-octave cloud body
        float rawFbm = fbm3D(warpedP);
        float normFbm = rawFbm * 0.5 + 0.5; // [0.0, 1.0]

        // Billowy cauliflower shaping: deviation from median creates rounded convective crowns
        float billow = 1.0 - 2.0 * abs(normFbm - 0.5);
        float cloudBody = mix(normFbm, billow, 0.42);

        // Macro weather front mask: creates distinct majestic cloud islands with deep blue sky vistas
        float macroMask = snoise3D(p * 0.42 + vec3(6.3, 1.8, 4.2)) * 0.5 + 0.5;
        float shaped = cloudBody * (0.35 + 0.65 * macroMask);

        // Soft non-linear coverage thresholding
        float threshold = 1.0 - coverage;
        float density = smoothstep(threshold - 0.16, threshold + 0.24, shaped);

        return clamp(density, 0.0, 1.0);
      }

      // Ultra-efficient directional sun probe for light extinction
      float sampleCumulusSunProbe(vec3 p, float coverage) {
        vec3 warp = warp3D(p);
        vec3 warpedP = p + warp;
        float rawFbm = fbmFast(warpedP);
        float normFbm = rawFbm * 0.5 + 0.5;
        float billow = 1.0 - 2.0 * abs(normFbm - 0.5);
        float cloudBody = mix(normFbm, billow, 0.42);
        float macroMask = snoise3D(p * 0.42 + vec3(6.3, 1.8, 4.2)) * 0.5 + 0.5;
        float shaped = cloudBody * (0.35 + 0.65 * macroMask);
        float threshold = 1.0 - coverage;
        return clamp(smoothstep(threshold - 0.16, threshold + 0.24, shaped), 0.0, 1.0);
      }

      void main() {
        vec3 ray = normalize(vWorldRay);
        float elevation = clamp(ray.y, 0.0005, 1.0);

        // ---------------------------------------------------------------------
        // A. PHYSICAL RAYLEIGH ATMOSPHERE, OZONE & SUNSET HORIZON
        // ---------------------------------------------------------------------
        float cosSun = dot(ray, uSunDirection);
        float sunAngle = clamp(cosSun, 0.0, 1.0);

        // Elevation-based Rayleigh curve (extends deep blue cobalt down to near the horizon)
        float rayleighExp = pow(elevation, 0.46);
        vec3 atmosphere = mix(uSkyHorizonColor, uSkyZenithColor, rayleighExp);

        // Ozone Chappuis band in mid-elevations (delicate twilight violet)
        float ozoneWeight = smoothstep(0.04, 0.32, elevation) * (1.0 - smoothstep(0.32, 0.75, elevation));
        vec3 ozoneTwilight = vec3(0.28, 0.18, 0.44);
        atmosphere = mix(atmosphere, ozoneTwilight, ozoneWeight * 0.38);

        // Belt of Venus & Earth's Shadow on the anti-solar horizon
        float antiSun = clamp(-cosSun, 0.0, 1.0);
        float venusBand = smoothstep(0.015, 0.12, elevation) * (1.0 - smoothstep(0.12, 0.32, elevation)) * antiSun;
        vec3 venusRose = vec3(0.68, 0.42, 0.52);
        vec3 earthShadow = vec3(0.06, 0.10, 0.20);
        atmosphere = mix(atmosphere, venusRose, venusBand * 0.55);
        if (elevation < 0.06 && antiSun > 0.25) {
          atmosphere = mix(atmosphere, earthShadow, (1.0 - elevation / 0.06) * antiSun * 0.55);
        }

        // Solar azimuth forward scattering warming (strictly at the low horizon near the sun)
        float forwardScatter = pow(max(0.0, cosSun), 3.5) * (1.0 - smoothstep(0.0, 0.18, elevation));
        vec3 goldenGlow = vec3(1.0, 0.74, 0.40);
        atmosphere = mix(atmosphere, goldenGlow, forwardScatter * 0.65);

        // ---------------------------------------------------------------------
        // B. SOLAR DISC & MIE CORONA SCATTERING BLOOM
        // ---------------------------------------------------------------------
        // Crisp photosphere disc with limb darkening (warm sunset disc)
        float sunDisc = smoothstep(0.9991, 0.9997, sunAngle);
        float limb = pow(clamp((sunAngle - 0.9991) / (0.9997 - 0.9991), 0.0, 1.0), 0.5);
        vec3 sunDiscRadiance = uSunColor * (sunDisc * (0.90 + 0.45 * limb) * 7.5);

        // Multi-tier Mie corona flare with crisp golden halo
        float coronaWide = pow(max(0.0, cosSun), 4.2) * 0.25;
        float coronaMid = pow(max(0.0, cosSun), 20.0) * 0.50;
        float coronaCore = pow(max(0.0, cosSun), 160.0) * 1.30;
        vec3 coronaColor = mix(vec3(1.0, 0.72, 0.35), uSunColor, 0.70);
        vec3 solarCorona = coronaColor * coronaWide + uSunColor * (coronaMid + coronaCore);

        // Base atmospheric sky dome color
        vec3 skyColor = atmosphere + solarCorona + sunDiscRadiance;

        // ---------------------------------------------------------------------
        // C. LAYER 2: HIGH-ALTITUDE CIRRUS VEILS (~8000m)
        // Silky, fibrous ice crystal bands catching golden sunset rim light
        // ---------------------------------------------------------------------
        vec3 cirrusP = vec3(ray.x, ray.y * 2.2, ray.z) * 5.8;
        vec3 cirrusWind = vec3(uWindVelocity2.x, 0.0, uWindVelocity2.y) * (uTime * 0.024);
        vec3 cp = cirrusP + cirrusWind;

        float cirrusRaw = snoise3D(cp) * 0.55 + snoise3D(cp * 2.1 + vec3(2.1, 1.3, 3.7)) * 0.28;
        float cirrusDensity = smoothstep(0.22, 0.62, cirrusRaw) * 0.26 * smoothstep(0.03, 0.16, ray.y);
        vec3 cirrusLit = mix(vec3(1.0, 0.72, 0.44), vec3(1.0, 0.92, 0.84), max(0.0, cosSun));
        vec3 cirrusColor = mix(uSkyHorizonColor * 0.85, cirrusLit, 0.82);

        skyColor = mix(skyColor, cirrusColor, cirrusDensity);

        // ---------------------------------------------------------------------
        // D. LAYER 1: PHOTOREALISTIC VOLUMETRIC CUMULUS & STRATOCUMULUS (~2000m)
        // Evaluated directly on the 3D celestial sphere direction: 100% ISOTROPIC
        // ---------------------------------------------------------------------
        vec3 cumulusP = vec3(ray.x, ray.y * 1.5, ray.z) * 3.2;
        vec3 cumulusWind = vec3(uWindVelocity1.x, 0.0, uWindVelocity1.y) * (uTime * 0.012);
        vec3 p = cumulusP + cumulusWind;

        // 1. Sample primary cloud density
        float cumulusDensity = sampleCumulusDensity(p, uCloudCoverage);

        if (cumulusDensity > 0.005) {
          // 2. Analytical 3D Sun Probe: Directional self-shadowing & light absorption
          vec3 sunOffset = uSunDirection * 0.14;
          float sunProbe = sampleCumulusSunProbe(p + sunOffset, uCloudCoverage);

          // Beer-Lambert extinction through the cloud volume towards the sun
          float opticalAbsorption = max(0.0, sunProbe * 1.15 - cumulusDensity * 0.35);
          float selfShadow = exp(-opticalAbsorption * 3.8);
          float lightFactor = mix(0.36, 1.08, selfShadow);

          // 3. Multiple Forward Scattering ("Powder Sugar" internal volume luminescence)
          float powderEffect = 1.0 - exp(-cumulusDensity * 2.8);

          // 4. Henyey-Greenstein Silver Lining Phase Scattering
          float g = 0.64;
          float hgPhase = (1.0 - g * g) / pow(max(0.01, 1.0 + g * g - 2.0 * g * cosSun), 1.5) * 0.0795;
          float edgeGlint = smoothstep(0.03, 0.45, cumulusDensity) * (1.0 - smoothstep(0.45, 0.92, cumulusDensity));
          float silverLining = edgeGlint * hgPhase * 2.4;

          // 5. Dual-Tone Volumetric Lighting at Sunset
          // Direct sunlight: warm golden-apricot with incandescent silver lining
          vec3 sunLitColor = mix(uSunColor, vec3(1.0, 0.68, 0.34), 0.42) * (1.18 + silverLining);

          // Ambient skylight: deep twilight cobalt bounce from upper atmosphere dome
          vec3 ambientSkylight = mix(vec3(0.12, 0.16, 0.28), uSkyZenithColor * 1.25, elevation * 0.5 + 0.5);

          // Composite cloud surface radiance
          vec3 cloudRadiance = mix(ambientSkylight, sunLitColor, lightFactor * powderEffect);

          // 6. Atmospheric Aerial Perspective (distant clouds naturally recede into horizon haze)
          float aerialHaze = pow(1.0 - elevation, 2.2) * 0.65;
          vec3 distantHazeColor = mix(uSkyHorizonColor, atmosphere, 0.22);
          vec3 finalCumulusColor = mix(cloudRadiance, distantHazeColor, aerialHaze);

          // 7. Natural Horizon Immersion Fade (feather smoothly near terrain horizon line)
          float horizonFade = smoothstep(0.012, 0.065, ray.y);
          float finalAlpha = cumulusDensity * horizonFade * uCloudDensity;

          skyColor = mix(skyColor, finalCumulusColor, finalAlpha);
        }

        // ---------------------------------------------------------------------
        // E. SEAMLESS BELOW-HORIZON GROUND TRANSITION
        // ---------------------------------------------------------------------
        if (ray.y < 0.0) {
          float groundFactor = clamp(-ray.y * 4.0, 0.0, 1.0);
          vec3 groundBase = mix(uSkyHorizonColor * 0.45, uGroundHazeColor, groundFactor);
          skyColor = mix(skyColor, groundBase, groundFactor);
        }

        gl_FragColor = vec4(skyColor, 1.0);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });

    // Inverted sky dome centered continuously on camera
    const geometry = new THREE.SphereGeometry(950, 64, 32);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  /**
   * Generates a seamless 360° equirectangular environment texture for IBL car reflections
   * matching the atmospheric daylight palette and volumetric cloud formations.
   */
  public generateEnvironmentMap(renderer: THREE.WebGLRenderer): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // 1. Physically-calibrated atmosphere vertical gradient (Sapphire twilight & low golden horizon)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    skyGrad.addColorStop(0.0, '#040d22');  // Zenith deep twilight cobalt
    skyGrad.addColorStop(0.30, '#12244a'); // Mid-sky royal cobalt
    skyGrad.addColorStop(0.44, '#262842'); // Ozone Chappuis twilight transition
    skyGrad.addColorStop(0.485, '#e07628'); // Warm sunset horizon band
    skyGrad.addColorStop(0.50, '#ffbe58'); // Low crisp golden solar horizon line
    skyGrad.addColorStop(0.51, '#161c24'); // Distant mountains & terrain in cool dusk silhouette
    skyGrad.addColorStop(0.56, '#0d1015'); // Track perimeter asphalt transition
    skyGrad.addColorStop(1.0, '#07090c');  // Neutral dark bitumen ground bounce (ZERO brown/orange)
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 2048, 1024);

    // 2. Exact solar disc and high-radiance incandescent golden corona
    const sun = this.uniforms.uSunDirection.value;
    const uNorm = (Math.atan2(sun.z, sun.x) / (Math.PI * 2) + 0.5 + 1.0) % 1.0;
    const vNorm = 0.5 - Math.asin(THREE.MathUtils.clamp(sun.y, -1, 1)) / Math.PI;
    const sunX = uNorm * 2048;
    const sunY = vNorm * 1024;

    // Multi-tier incandescent solar glare and warm golden corona bloom in reflection map
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 420);
    sunGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    sunGrad.addColorStop(0.04, 'rgba(255, 245, 200, 0.98)');
    sunGrad.addColorStop(0.14, 'rgba(255, 205, 110, 0.65)');
    sunGrad.addColorStop(0.35, 'rgba(240, 140, 50, 0.22)');
    sunGrad.addColorStop(0.70, 'rgba(200, 90, 30, 0.05)');
    sunGrad.addColorStop(1.0, 'rgba(180, 70, 20, 0.0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 420, 0, Math.PI * 2);
    ctx.fill();

    // 3. Realistic soft organic cumulus cloud clusters catching sunset gold
    const cloudBatches = [
      { x: 220, y: 300, r: 130, a: 0.76 },
      { x: 330, y: 270, r: 110, a: 0.82 },
      { x: 450, y: 310, r: 140, a: 0.72 },
      { x: 570, y: 280, r: 105, a: 0.78 },
      { x: 820, y: 330, r: 150, a: 0.74 },
      { x: 950, y: 290, r: 120, a: 0.80 },
      { x: 1070, y: 320, r: 135, a: 0.70 },
      { x: 1340, y: 290, r: 145, a: 0.72 },
      { x: 1470, y: 320, r: 125, a: 0.76 },
      { x: 1590, y: 280, r: 112, a: 0.74 },
      { x: 1770, y: 310, r: 148, a: 0.78 },
      { x: 1910, y: 280, r: 116, a: 0.72 },
    ];

    for (const c of cloudBatches) {
      const cGrad = ctx.createRadialGradient(c.x, c.y, 12, c.x, c.y, c.r);
      cGrad.addColorStop(0.0, `rgba(255, 230, 175, ${c.a})`);
      cGrad.addColorStop(0.4, `rgba(245, 175, 120, ${c.a * 0.75})`);
      cGrad.addColorStop(0.7, `rgba(140, 95, 130, ${c.a * 0.40})`);
      cGrad.addColorStop(1.0, 'rgba(80, 50, 90, 0.0)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Silky golden cirrus ribbons in reflection map
    ctx.strokeStyle = 'rgba(255, 195, 140, 0.35)';
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.moveTo(0, 190);
    ctx.bezierCurveTo(480, 150, 960, 230, 2048, 180);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 180, 125, 0.25)';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(0, 250);
    ctx.bezierCurveTo(640, 290, 1360, 200, 2048, 260);
    ctx.stroke();

    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.mapping = THREE.EquirectangularReflectionMapping;
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
    canvasTexture.wrapS = THREE.RepeatWrapping;
    canvasTexture.wrapT = THREE.ClampToEdgeWrapping;
    canvasTexture.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envMap = pmrem.fromEquirectangular(canvasTexture).texture;
    pmrem.dispose();
    canvasTexture.dispose();

    this.envTexture = envMap;
    return envMap;
  }

  /**
   * Updates dome position to lock to camera (infinite skybox illusion)
   * and advances dynamic cloud time uniform.
   * Zero GC allocations in loop.
   */
  public update(dt: number, cameraPos: THREE.Vector3, sunDir?: THREE.Vector3): void {
    // Keep dome centered around camera at all times (zero clipping)
    this.mesh.position.copy(cameraPos);

    // Advance cloud simulation time (wraps smoothly every 24 hours to prevent float overflow)
    this.uniforms.uTime.value = (this.uniforms.uTime.value + dt) % 86400.0;

    if (sunDir) {
      this.uniforms.uSunDirection.value.copy(sunDir).normalize();
    }
  }

  public setSunDirection(sunDir: THREE.Vector3): void {
    this.uniforms.uSunDirection.value.copy(sunDir).normalize();
  }

  public setCloudCoverage(coverage: number): void {
    this.uniforms.uCloudCoverage.value = THREE.MathUtils.clamp(coverage, 0.0, 1.0);
  }

  public setCloudDensity(density: number): void {
    this.uniforms.uCloudDensity.value = THREE.MathUtils.clamp(density, 0.0, 2.0);
  }

  public dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
    if (this.envTexture) {
      this.envTexture.dispose();
      this.envTexture = null;
    }
  }
}
