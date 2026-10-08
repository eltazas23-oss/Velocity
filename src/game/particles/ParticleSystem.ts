/**
 * ParticleSystem.ts - Next-Gen 3D Particle & Collision FX Engine
 * 
 * Includes:
 * 1. Camera-Facing Velocity Ribbons with Analytical Gaussian HDR Core & Blackbody Thermal Radiation
 * 2. Continuous High-Frequency Wall Scraping Spark Cascade (Fricción Continua de Titanio)
 * 3. Chassis Aerodynamic Slipstream Vortices & Wake Entrainment (Estela Turbulenta)
 * 4. Dynamic Specular Ground Contact Glow & Tarmac Scorch Decals (Reflejo en Asfalto y Quemaduras)
 * 5. 3D Carbon Fiber Fracture Shards, Volumetric Bilow Tire Smoke, and Flash Illumination
 */

import * as THREE from 'three';

interface Spark {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface SmokePuff {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
  maxSize: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  maxOpacity: number;
  life: number;
  maxLife: number;
  colorR: number;
  colorG: number;
  colorB: number;
  growthExponent: number;
  buoyancy: number;
  drag: number;
}

interface DebrisChunk {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Vector3;
  angVel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ScorchMark {
  x: number;
  z: number;
  radius: number;
  life: number;
  maxLife: number;
  rotation: number;
  opacity: number;
}

export class ParticleSystem {
  public group: THREE.Group;

  // --- 1. Camera-Facing Velocity-Aligned Ribbon Sparks (Instanced Custom Shader) ---
  private sparks: Spark[] = [];
  private sparkPool: Spark[] = [];
  private sparkMesh!: THREE.Mesh;
  private sparkInstGeo!: THREE.InstancedBufferGeometry;
  private sparkInstPos!: Float32Array;
  private sparkInstVel!: Float32Array;
  private sparkInstLife!: Float32Array;
  private maxSparks = 220;
  private sparkSpawnAccumulator = 0;
  private vortexTime = 0;

  // --- 2. Ultra-Realistic Volumetric Smoke System (Instanced Quads with FBM Noise Erosion & Light Extinction) ---
  private smokePuffs: SmokePuff[] = [];
  private smokePool: SmokePuff[] = [];
  private smokeMesh!: THREE.Mesh;
  private smokeInstGeo!: THREE.InstancedBufferGeometry;
  private smokeMaterial!: THREE.ShaderMaterial;
  private smokeInstPos!: Float32Array;      // vec3 (x, y, z)
  private smokeInstParams!: Float32Array;   // vec4 (size, rotation, opacity, progress)
  private smokeInstColor!: Float32Array;    // vec4 (r, g, b, coreAbsorption)
  private smokeInstVel!: Float32Array;      // vec3 (vx, vy, vz)
  private maxSmoke = 560;
  private sunDirection = new THREE.Vector3(-0.6, 0.7, 0.4).normalize();
  private smokeTime = 0;
  private lastTireSmokePositions: THREE.Vector3[] = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  private lastTireSmokeActive: boolean[] = [false, false, false, false];

  // --- 3. 3D Carbon Fiber Fracture Shards (Single Batched InstancedMesh) ---
  private debrisList: DebrisChunk[] = [];
  private debrisPool: DebrisChunk[] = [];
  private debrisMesh!: THREE.InstancedMesh;
  private maxDebris = 60;

  // --- 4. Dynamic Collision Flash Light ---
  private impactLight!: THREE.PointLight;

  // --- 5. Ground Contact Glow (Specular Asphalt Reflection) ---
  private groundGlowMesh!: THREE.Mesh;
  private groundGlowMaterial!: THREE.MeshBasicMaterial;
  private groundGlowPos = new THREE.Vector3();
  private groundGlowIntensity = 0;

  // --- 6. Tarmac Scorch Marks (Quemaduras y Marcas de Hollín) ---
  private scorchList: ScorchMark[] = [];
  private scorchMesh!: THREE.InstancedMesh;
  private maxScorches = 32;
  private scorchTexture!: THREE.CanvasTexture;

  // --- 7. Dynamic 4-Wheel Persistent Tire Skid Marks Mesh ---
  private skidMesh!: THREE.Mesh;
  private skidPositions!: Float32Array;
  private skidAlphas!: Float32Array;
  private maxSkidPoints = 1200; // Optimal performance capacity (7,200 vertices, 86 KB buffer)
  private skidIndex = 0;
  private lastWheelPositions: THREE.Vector3[] = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]; // [FL, FR, RL, RR]
  private lastWheelActive: boolean[] = [false, false, false, false];
  private lastLeftWheelPos: THREE.Vector3 | null = null;
  private lastRightWheelPos: THREE.Vector3 | null = null;

  // --- 8. Aerodynamic Wingtip Vortex Streamer Ribbons ---
  private vortexRibbonMesh!: THREE.Mesh;
  private vortexPositions!: Float32Array;
  private vortexColors!: Float32Array;
  private maxVortexPoints = 48; // 24 segments per wingtip
  private leftVortexHistory: THREE.Vector3[] = [];
  private rightVortexHistory: THREE.Vector3[] = [];

  // Procedural Textures
  private smokeTexture!: THREE.CanvasTexture;
  private groundGlowTexture!: THREE.CanvasTexture;

  // Scratch objects for zero runtime GC allocations
  private prevActiveSparks = 0;
  private prevActiveSmoke = 0;
  private prevActiveDebris = 0;
  private prevActiveScorches = 0;

  // Pools to eliminate GC allocation completely
  private scorchPool: ScorchMark[] = [];

  /**
   * High-Performance O(1) swap-and-pop to eliminate O(N) array shift memory reindexing
   */
  private popOldest<T>(list: T[]): T {
    if (list.length <= 1) return list.pop()!;
    const oldest = list[0];
    list[0] = list.pop()!;
    return oldest;
  }

  private _scratchVec1 = new THREE.Vector3();
  private _scratchVec2 = new THREE.Vector3();
  private _scratchVec3 = new THREE.Vector3();
  private _scratchVec4 = new THREE.Vector3();

  private _debrisMatrix = new THREE.Matrix4();
  private _debrisQuat = new THREE.Quaternion();
  private _debrisEuler = new THREE.Euler();
  private _debrisScale = new THREE.Vector3();

  private _scorchMatrix = new THREE.Matrix4();
  private _scorchQuat = new THREE.Quaternion();
  private _scorchEuler = new THREE.Euler(-Math.PI / 2, 0, 0);
  private _scorchScale = new THREE.Vector3();
  private _scorchPos = new THREE.Vector3();

  private _skidP1 = new THREE.Vector3();
  private _skidP2 = new THREE.Vector3();
  private _skidP3 = new THREE.Vector3();
  private _skidP4 = new THREE.Vector3();

  constructor() {
    this.group = new THREE.Group();

    // 1. Pre-allocate spark object pool
    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkPool.push({
        position: new THREE.Vector3(0, -99999, 0),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0,
      });
    }

    // 2. Pre-allocate volumetric smoke puff object pool
    for (let i = 0; i < this.maxSmoke; i++) {
      this.smokePool.push({
        position: new THREE.Vector3(0, -99999, 0),
        velocity: new THREE.Vector3(),
        size: 0.5,
        maxSize: 3.2,
        rotation: 0,
        rotationSpeed: 0,
        opacity: 0.8,
        maxOpacity: 0.8,
        life: 0,
        maxLife: 1.0,
        colorR: 0.95,
        colorG: 0.95,
        colorB: 0.97,
        growthExponent: 0.45,
        buoyancy: 0.35,
        drag: 1.3,
      });
    }

    // 3. Pre-allocate debris object pool
    for (let i = 0; i < this.maxDebris; i++) {
      this.debrisPool.push({
        position: new THREE.Vector3(0, -99999, 0),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Vector3(),
        angVel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
      });
    }

    // 4. Pre-allocate scorch marks pool
    for (let i = 0; i < this.maxScorches; i++) {
      this.scorchPool.push({
        x: 0,
        z: 0,
        radius: 0.2,
        life: 0,
        maxLife: 2.0,
        rotation: 0,
        opacity: 0.8,
      });
    }

    this.createTextures();
    this.initSparksShader();
    this.initVolumetricSmoke();
    this.initDebris();
    this.initGroundContactGlow();
    this.initScorchMarks();
    this.initSkidmarks();
    this.initWingtipVortices();
  }

  /**
   * Set directional sun vector for dynamic volumetric smoke lighting and forward scattering
   */
  public setSunDirection(dir: THREE.Vector3): void {
    this.sunDirection.copy(dir).normalize();
    if (this.smokeMaterial && this.smokeMaterial.uniforms.uSunDir) {
      this.smokeMaterial.uniforms.uSunDir.value.copy(this.sunDirection);
    }
  }

  /**
   * Generates procedural radial alpha masks and scorch textures
   */
  private createTextures(): void {
    // 1. High-Fidelity Multi-Octave Volumetric Cumulus Smoke Texture (256x256)
    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = 256;
    smokeCanvas.height = 256;
    const sCtx = smokeCanvas.getContext('2d')!;

    sCtx.clearRect(0, 0, 256, 256);

    // Multi-scale overlapping cellular billow lobes
    const baseGrad = sCtx.createRadialGradient(128, 128, 8, 128, 128, 122);
    baseGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
    baseGrad.addColorStop(0.35, 'rgba(245, 245, 248, 0.78)');
    baseGrad.addColorStop(0.65, 'rgba(220, 225, 235, 0.38)');
    baseGrad.addColorStop(0.88, 'rgba(180, 185, 195, 0.09)');
    baseGrad.addColorStop(1.0, 'rgba(140, 145, 155, 0.0)');
    sCtx.fillStyle = baseGrad;
    sCtx.fillRect(0, 0, 256, 256);

    // 48 Organic cellular micro-lobes creating billowy cauliflower/cumulus edges
    const seedPoints = [
      { r: 0.25, lobes: 10, radiusMin: 24, radiusMax: 42, alpha: 0.22 },
      { r: 0.50, lobes: 18, radiusMin: 18, radiusMax: 34, alpha: 0.16 },
      { r: 0.72, lobes: 20, radiusMin: 14, radiusMax: 26, alpha: 0.10 },
    ];

    for (const tier of seedPoints) {
      for (let i = 0; i < tier.lobes; i++) {
        const angle = (i / tier.lobes) * Math.PI * 2 + (Math.sin(i * 3.7) * 0.4);
        const dist = tier.r * 110 + (Math.cos(i * 2.1) * 12);
        const lx = 128 + Math.cos(angle) * dist;
        const ly = 128 + Math.sin(angle) * dist;
        const lRadius = tier.radiusMin + ((i * 17) % 11) * 1.5;

        const lobeGrad = sCtx.createRadialGradient(lx, ly, 2, lx, ly, lRadius);
        lobeGrad.addColorStop(0.0, `rgba(255, 255, 255, ${tier.alpha})`);
        lobeGrad.addColorStop(0.5, `rgba(240, 242, 248, ${tier.alpha * 0.55})`);
        lobeGrad.addColorStop(1.0, 'rgba(200, 205, 215, 0.0)');
        sCtx.fillStyle = lobeGrad;
        sCtx.beginPath();
        sCtx.arc(lx, ly, lRadius, 0, Math.PI * 2);
        sCtx.fill();
      }
    }
    this.smokeTexture = new THREE.CanvasTexture(smokeCanvas);

    // 2. Specular Ground Reflection Glow Texture (Gaussian Radial)
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const gCtx = glowCanvas.getContext('2d')!;
    const gGrad = gCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
    gGrad.addColorStop(0.0, 'rgba(255, 240, 180, 1.0)');
    gGrad.addColorStop(0.25, 'rgba(255, 180, 60, 0.75)');
    gGrad.addColorStop(0.55, 'rgba(255, 100, 20, 0.35)');
    gGrad.addColorStop(0.85, 'rgba(180, 40, 0, 0.10)');
    gGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    gCtx.fillStyle = gGrad;
    gCtx.fillRect(0, 0, 128, 128);
    this.groundGlowTexture = new THREE.CanvasTexture(glowCanvas);

    // 3. Tarmac Scorch / Carbon Burn Texture
    const scorchCanvas = document.createElement('canvas');
    scorchCanvas.width = 128;
    scorchCanvas.height = 128;
    const scCtx = scorchCanvas.getContext('2d')!;
    const scGrad = scCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
    scGrad.addColorStop(0.0, 'rgba(10, 10, 12, 0.95)');
    scGrad.addColorStop(0.4, 'rgba(18, 18, 22, 0.75)');
    scGrad.addColorStop(0.7, 'rgba(25, 25, 30, 0.35)');
    scGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    scCtx.fillStyle = scGrad;
    scCtx.fillRect(0, 0, 128, 128);

    // Irregular splatter spots around scorch burn
    scCtx.fillStyle = 'rgba(8, 8, 10, 0.6)';
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 38;
      const rx = 64 + Math.cos(angle) * dist;
      const ry = 64 + Math.sin(angle) * dist;
      const rad = 3 + Math.random() * 8;
      scCtx.beginPath();
      scCtx.arc(rx, ry, rad, 0, Math.PI * 2);
      scCtx.fill();
    }
    this.scorchTexture = new THREE.CanvasTexture(scorchCanvas);
  }

  /**
   * Module 1: Camera-Facing Velocity Ribbons with Analytical Gaussian HDR Core & Blackbody Radiance
   */
  private initSparksShader(): void {
    const baseGeo = new THREE.PlaneGeometry(1.0, 1.0);
    this.sparkInstGeo = new THREE.InstancedBufferGeometry();
    this.sparkInstGeo.index = baseGeo.index;
    this.sparkInstGeo.attributes.position = baseGeo.attributes.position;
    this.sparkInstGeo.attributes.uv = baseGeo.attributes.uv;

    this.sparkInstPos = new Float32Array(this.maxSparks * 3);
    this.sparkInstVel = new Float32Array(this.maxSparks * 3);
    this.sparkInstLife = new Float32Array(this.maxSparks * 2);

    // Initialize all instances off-screen
    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkInstPos[i * 3 + 1] = -99999;
      this.sparkInstLife[i * 2 + 1] = 0;
    }

    const posAttr = new THREE.InstancedBufferAttribute(this.sparkInstPos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    this.sparkInstGeo.setAttribute('aInstancePos', posAttr);

    const velAttr = new THREE.InstancedBufferAttribute(this.sparkInstVel, 3);
    velAttr.setUsage(THREE.DynamicDrawUsage);
    this.sparkInstGeo.setAttribute('aInstanceVel', velAttr);

    const lifeAttr = new THREE.InstancedBufferAttribute(this.sparkInstLife, 2);
    lifeAttr.setUsage(THREE.DynamicDrawUsage);
    this.sparkInstGeo.setAttribute('aInstanceLife', lifeAttr);

    const sparkMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 aInstancePos;
        attribute vec3 aInstanceVel;
        attribute vec2 aInstanceLife; // (currentLife, maxLife)

        varying vec2 vUv;
        varying float vProgress;

        void main() {
          vUv = uv;
          float maxLife = aInstanceLife.y;
          float life = aInstanceLife.x;
          float progress = maxLife > 0.0 ? clamp(life / maxLife, 0.0, 1.0) : 1.0;
          vProgress = progress;

          if (maxLife <= 0.0 || progress >= 1.0) {
            gl_Position = vec4(0.0, -99999.0, 0.0, 1.0);
            return;
          }

          float speed = length(aInstanceVel);
          vec3 forward = speed > 0.001 ? normalize(aInstanceVel) : vec3(0.0, 0.0, 1.0);

          // Velocity ribbon length & dynamic thickness
          float lengthScale = clamp(speed * 0.075 + 0.18, 0.18, 1.6);
          float thickness = clamp((1.0 - progress) * 0.038, 0.004, 0.038);

          // Calculate view-aligned side vector
          vec3 toCamera = normalize(cameraPosition - aInstancePos);
          vec3 side = cross(forward, toCamera);
          float sideLen = length(side);
          if (sideLen < 0.001) {
            side = abs(forward.y) < 0.99 ? cross(forward, vec3(0.0, 1.0, 0.0)) : cross(forward, vec3(1.0, 0.0, 0.0));
          }
          side = normalize(side);

          // Trailing ribbon vertex computation (front at uv.y = 0.0, tail at uv.y = 1.0)
          vec3 worldPos = aInstancePos - (forward * (uv.y * lengthScale)) + (side * ((uv.x - 0.5) * thickness));

          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vProgress;

        void main() {
          if (vProgress >= 1.0) discard;

          // Transverse analytical Gaussian profile from centerline (uv.x = 0.5)
          float distFromCenter = abs(vUv.x - 0.5) * 2.0;
          float coreGlow = exp(-distFromCenter * distFromCenter * 14.0); // Intense super-white core
          float haloGlow = exp(-distFromCenter * distFromCenter * 3.2) * 0.72; // Soft thermal glow

          // Longitudinal taper: hot needle point at front, smooth decay toward tail
          float tailFade = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.25);
          float alpha = (coreGlow + haloGlow) * tailFade * (1.0 - vProgress);
          if (alpha < 0.005) discard;

          // Blackbody Thermal Radiation Spectrum
          // 0.00 - 0.18: Incandescent White-Hot (+2600K)
          // 0.18 - 0.45: Brilliant Electric Gold (1900K)
          // 0.45 - 0.75: Deep Molten Orange (1200K)
          // 0.75 - 1.00: Dark Cherry Crimson Ember (750K) -> Off
          vec3 thermalColor;
          if (vProgress < 0.18) {
            float f = vProgress / 0.18;
            thermalColor = mix(vec3(1.4, 1.4, 1.3), vec3(1.15, 0.95, 0.28), f);
          } else if (vProgress < 0.45) {
            float f = (vProgress - 0.18) / 0.27;
            thermalColor = mix(vec3(1.15, 0.95, 0.28), vec3(1.0, 0.46, 0.06), f);
          } else if (vProgress < 0.75) {
            float f = (vProgress - 0.45) / 0.30;
            thermalColor = mix(vec3(1.0, 0.46, 0.06), vec3(0.65, 0.08, 0.0), f);
          } else {
            float f = (vProgress - 0.75) / 0.25;
            thermalColor = mix(vec3(0.65, 0.08, 0.0), vec3(0.04, 0.0, 0.0), f);
          }

          vec3 finalColor = mix(thermalColor, vec3(1.6, 1.6, 1.55), coreGlow * (1.0 - vProgress * 0.65));

          gl_FragColor = vec4(finalColor * alpha, alpha);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.sparkMesh = new THREE.Mesh(this.sparkInstGeo, sparkMaterial);
    this.sparkMesh.frustumCulled = false;
    this.group.add(this.sparkMesh);

    // Dynamic Collision Impact Flash Light
    this.impactLight = new THREE.PointLight(0xffdd66, 0, 18, 2.0);
    this.group.add(this.impactLight);
  }

  /**
   * Module 4: Dynamic Specular Ground Contact Glow (Reflejo en Asfalto)
   */
  private initGroundContactGlow(): void {
    const glowGeo = new THREE.PlaneGeometry(3.6, 3.6);
    glowGeo.rotateX(-Math.PI / 2);

    this.groundGlowMaterial = new THREE.MeshBasicMaterial({
      map: this.groundGlowTexture,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -4.0,
    });

    this.groundGlowMesh = new THREE.Mesh(glowGeo, this.groundGlowMaterial);
    this.groundGlowMesh.position.set(0, 0.015, 0);
    this.groundGlowMesh.visible = false;
    this.group.add(this.groundGlowMesh);
  }

  /**
   * Module 4: Tarmac Scorch Marks (Marcas de Quemaduras y Hollín en el Asfalto)
   */
  private initScorchMarks(): void {
    const scorchGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const scorchMat = new THREE.MeshBasicMaterial({
      map: this.scorchTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.5,
      polygonOffsetUnits: -6.0,
    });

    this.scorchMesh = new THREE.InstancedMesh(scorchGeo, scorchMat, this.maxScorches);
    this.scorchMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scorchMesh.frustumCulled = false;

    // Initialize all scorch instances off-screen
    const offMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    offMatrix.setPosition(0, -999, 0);
    for (let i = 0; i < this.maxScorches; i++) {
      this.scorchMesh.setMatrixAt(i, offMatrix);
    }
    this.scorchMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.scorchMesh);
  }

  private initVolumetricSmoke(): void {
    const baseGeo = new THREE.PlaneGeometry(1.0, 1.0);
    this.smokeInstGeo = new THREE.InstancedBufferGeometry();
    this.smokeInstGeo.index = baseGeo.index;
    this.smokeInstGeo.attributes.position = baseGeo.attributes.position;
    this.smokeInstGeo.attributes.uv = baseGeo.attributes.uv;

    this.smokeInstPos = new Float32Array(this.maxSmoke * 3);
    this.smokeInstParams = new Float32Array(this.maxSmoke * 4); // [size, rotation, opacity, progress]
    this.smokeInstColor = new Float32Array(this.maxSmoke * 4);  // [r, g, b, coreAbsorption]
    this.smokeInstVel = new Float32Array(this.maxSmoke * 3);

    // Initialize all instances off-screen
    for (let i = 0; i < this.maxSmoke; i++) {
      this.smokeInstPos[i * 3 + 1] = -99999;
      this.smokeInstParams[i * 4 + 2] = 0.0;
    }

    const posAttr = new THREE.InstancedBufferAttribute(this.smokeInstPos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    this.smokeInstGeo.setAttribute('aInstancePos', posAttr);

    const paramsAttr = new THREE.InstancedBufferAttribute(this.smokeInstParams, 4);
    paramsAttr.setUsage(THREE.DynamicDrawUsage);
    this.smokeInstGeo.setAttribute('aInstanceParams', paramsAttr);

    const colorAttr = new THREE.InstancedBufferAttribute(this.smokeInstColor, 4);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.smokeInstGeo.setAttribute('aInstanceColor', colorAttr);

    const velAttr = new THREE.InstancedBufferAttribute(this.smokeInstVel, 3);
    velAttr.setUsage(THREE.DynamicDrawUsage);
    this.smokeInstGeo.setAttribute('aInstanceVel', velAttr);

    this.smokeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: this.smokeTexture },
        uSunDir: { value: this.sunDirection },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        attribute vec3 aInstancePos;
        attribute vec4 aInstanceParams; // x: size, y: rotation, z: opacity, w: progress
        attribute vec4 aInstanceColor;  // rgb: color, a: coreDensity
        attribute vec3 aInstanceVel;

        varying vec2 vUv;
        varying vec4 vColor;
        varying vec3 vWorldPos;
        varying float vProgress;

        void main() {
          vUv = uv;
          float size = aInstanceParams.x;
          float rot = aInstanceParams.y;
          float opacity = aInstanceParams.z;
          float progress = aInstanceParams.w;
          vProgress = progress;

          if (opacity <= 0.001 || size <= 0.001) {
            gl_Position = vec4(0.0, -99999.0, 0.0, 1.0);
            return;
          }

          // Billboard orientation vectors from camera view matrix
          vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

          // In-plane continuous rotation
          float c = cos(rot);
          float s = sin(rot);
          vec2 localPos = position.xy;
          vec2 rotatedOffset = vec2(
            localPos.x * c - localPos.y * s,
            localPos.x * s + localPos.y * c
          );

          // Dynamic velocity elongation along velocity vector for tire spray
          float speed = length(aInstanceVel);
          vec3 velDir = speed > 0.1 ? aInstanceVel / speed : vec3(0.0);
          float stretch = clamp(speed * 0.04, 0.0, 0.40) * (1.0 - progress);

          vec3 worldPos = aInstancePos
            + (camRight * rotatedOffset.x + camUp * rotatedOffset.y) * size
            - velDir * (rotatedOffset.y * stretch * size);

          vWorldPos = worldPos;
          vColor = vec4(aInstanceColor.rgb, opacity);

          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uSunDir;
        uniform float uTime;

        varying vec2 vUv;
        varying vec4 vColor;
        varying vec3 vWorldPos;
        varying float vProgress;

        // Fast analytical 2D Simplex/FBM Noise
        vec2 hash2(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
        }

        float noise2D(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
            mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float fbm2D(vec2 p) {
          float v = 0.0;
          v += 0.5000 * noise2D(p); p *= 2.02;
          v += 0.2500 * noise2D(p); p *= 2.03;
          v += 0.1250 * noise2D(p);
          return v;
        }

        void main() {
          // 1. Dynamic Organic UV Swirling Turbulence
          vec2 swirlOffset = hash2(vUv * 3.5 + uTime * 0.35 + vProgress * 2.5) * (0.045 * vProgress);
          vec2 distUv = clamp(vUv + swirlOffset, 0.0, 1.0);
          vec4 tex = texture2D(uTexture, distUv);
          if (tex.a < 0.005) discard;

          // 2. Multi-Octave FBM Noise Erosion (Organic filament dissolution)
          float nVal = fbm2D(distUv * 4.2 + vec2(vProgress * 0.9, uTime * 0.15));
          float noiseNorm = nVal * 0.5 + 0.5;
          float erosionThreshold = vProgress * 0.55;
          float alphaErosion = smoothstep(erosionThreshold, erosionThreshold + 0.35, noiseNorm);

          // 3. Analytical Hemispherical Normal (Sphere Impostor for true 3D curvature)
          vec2 nUv = (vUv - 0.5) * 2.0;
          float rSq = dot(nUv, nUv);
          float nz = sqrt(max(0.0, 1.0 - rSq * 0.82));
          vec2 normalPerturb = (hash2(distUv * 6.0 + uTime * 0.2) * 0.22) * (1.0 - vProgress * 0.5);
          vec3 norm = normalize(vec3(nUv * 0.72 + normalPerturb, nz));

          // Camera-facing space to World space
          vec3 toCam = normalize(cameraPosition - vWorldPos);
          vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
          vec3 up = cross(toCam, right);
          vec3 worldNormal = normalize(right * norm.x + up * norm.y + toCam * norm.z);

          // 4. Direct Sunlight with Half-Lambert diffuse scattering
          vec3 sunDir = normalize(uSunDir);
          float NdotL = dot(worldNormal, sunDir);
          float directLight = clamp(NdotL * 0.58 + 0.42, 0.20, 1.25);

          // 5. Forward Scattering (Mie phase backlighting glow: radiant white/silver when looking into sun)
          float VdotL = clamp(dot(toCam, -sunDir), 0.0, 1.0);
          float forwardScatter = pow(VdotL, 3.5) * 0.52;

          // 6. Ambient Hemispheric Skylight & Dark Asphalt Ground Absorption
          float skyGround = clamp(worldNormal.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 skyLight = vec3(0.78, 0.82, 0.92);
          vec3 asphaltAbsorption = vec3(0.20, 0.21, 0.24);
          vec3 ambientEnv = mix(asphaltAbsorption, skyLight, skyGround);

          // 7. Volumetric Cavity Occlusion & Optical Depth (Beer-Lambert attenuation)
          float coreDensity = pow(nz, 1.35);
          float cavityOcclusion = clamp(0.65 + 0.35 * noiseNorm, 0.4, 1.0);
          vec3 sunShading = vec3(1.15, 1.10, 1.04) * (directLight * cavityOcclusion);

          vec3 litColor = vColor.rgb * (ambientEnv * 0.50 + sunShading) + vec3(1.0, 0.98, 0.94) * forwardScatter;

          // 8. Ground Soft Contact Fade (Eliminates ugly planar floor cuts at y = 0)
          float groundFade = clamp((vWorldPos.y - 0.010) / 0.16, 0.0, 1.0);

          // 9. Combined Final Alpha
          float finalAlpha = tex.a * vColor.a * (0.40 + 0.60 * coreDensity) * alphaErosion * groundFade;
          if (finalAlpha < 0.005) discard;

          gl_FragColor = vec4(litColor, finalAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.smokeMesh = new THREE.Mesh(this.smokeInstGeo, this.smokeMaterial);
    this.smokeMesh.frustumCulled = false;
    this.group.add(this.smokeMesh);
  }

  private initDebris(): void {
    // Realistic 3D aerodynamic carbon composite plate shard
    const shardGeo = new THREE.BoxGeometry(0.18, 0.015, 0.10);
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.32,
      metalness: 0.88,
      side: THREE.DoubleSide,
    });

    this.debrisMesh = new THREE.InstancedMesh(shardGeo, carbonMat, this.maxDebris);
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.frustumCulled = false;

    const offMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    offMatrix.setPosition(0, -999, 0);
    for (let i = 0; i < this.maxDebris; i++) {
      this.debrisMesh.setMatrixAt(i, offMatrix);
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.debrisMesh);
  }

  private initSkidmarks(): void {
    const geo = new THREE.BufferGeometry();
    const totalVertices = this.maxSkidPoints * 6;
    this.skidPositions = new Float32Array(totalVertices * 3);
    this.skidAlphas = new Float32Array(totalVertices * 4);

    geo.setAttribute('position', new THREE.BufferAttribute(this.skidPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.skidAlphas, 4));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -4.0,
    });

    this.skidMesh = new THREE.Mesh(geo, mat);
    this.skidMesh.frustumCulled = false;
    this.group.add(this.skidMesh);
  }

  /**
   * Spawn a persistent tarmac scorch mark decal that smoothly fades out
   */
  public addScorchMark(x: number, z: number, radius: number = 0.22): void {
    let sc: ScorchMark;
    if (this.scorchPool.length > 0) {
      sc = this.scorchPool.pop()!;
    } else if (this.scorchList.length >= this.maxScorches) {
      sc = this.popOldest(this.scorchList)!;
    } else {
      sc = { x: 0, z: 0, radius: 0.2, life: 0, maxLife: 2.0, rotation: 0, opacity: 0.8 };
    }

    sc.x = x;
    sc.z = z;
    sc.radius = Math.max(0.12, Math.min(0.45, radius));
    sc.life = 0;
    sc.maxLife = 2.2 + Math.random() * 1.0;
    sc.rotation = Math.random() * Math.PI * 2;
    sc.opacity = 0.85;
    this.scorchList.push(sc);
  }

  /**
   * Module 2: Continuous High-Frequency Wall Scraping Spark Cascade (Fricción Continua)
   * Emits dense stream of micro-sparks spraying tangentially along barriers during scraping
   */
  public emitContinuousScrapeSparks(
    contactPos: THREE.Vector3,
    wallNormal: THREE.Vector3,
    carVelocity: THREE.Vector3,
    dt: number,
    intensity: number = 0.5
  ): void {
    const carSpeed = carVelocity.length();
    if (carSpeed < 1.0) return;

    // Tangential direction along the wall
    const dot = carVelocity.dot(wallNormal);
    const tangX = carVelocity.x - wallNormal.x * dot;
    const tangZ = carVelocity.z - wallNormal.z * dot;
    const tangLen = Math.sqrt(tangX * tangX + tangZ * tangZ) || 1.0;
    const dirX = tangX / tangLen;
    const dirZ = tangZ / tangLen;

    // Spawn continuous micro-sparks based on friction intensity and dt (framerate invariant)
    this.sparkSpawnAccumulator += intensity * 180.0 * Math.max(0.001, Math.min(0.05, dt));
    const count = Math.min(12, Math.floor(this.sparkSpawnAccumulator));
    this.sparkSpawnAccumulator -= count;

    for (let i = 0; i < count; i++) {
      let spark: Spark;
      if (this.sparkPool.length > 0) {
        spark = this.sparkPool.pop()!;
      } else if (this.sparks.length < this.maxSparks) {
        spark = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 0 };
      } else {
        spark = this.popOldest(this.sparks)!;
      }

      const spread = 0.25;
      const speed = carSpeed * (0.85 + Math.random() * 0.9) + 4.0;
      spark.position.set(
        contactPos.x + (Math.random() - 0.5) * 0.15,
        contactPos.y + Math.random() * 0.25,
        contactPos.z + (Math.random() - 0.5) * 0.15
      );
      spark.velocity.set(
        dirX * speed + wallNormal.x * (Math.random() * 2.5 + 0.8) + (Math.random() - 0.5) * spread * 6.0,
        Math.random() * 3.2 + 0.4,
        dirZ * speed + wallNormal.z * (Math.random() * 2.5 + 0.8) + (Math.random() - 0.5) * spread * 6.0
      );
      spark.life = 0;
      spark.maxLife = 0.22 + Math.random() * 0.38;
      this.sparks.push(spark);
    }

    // Trigger specular ground contact glow
    this.groundGlowPos.copy(contactPos);
    this.groundGlowIntensity = Math.min(1.0, this.groundGlowIntensity + intensity * 0.6);

    // Random scorch burn on ground under scraping contact
    if (Math.random() < 0.20) {
      this.addScorchMark(contactPos.x + (Math.random() - 0.5) * 0.3, contactPos.z + (Math.random() - 0.5) * 0.3, 0.18 + intensity * 0.15);
    }
  }

  /**
   * Module 2.5: Formula 1 Titanium Skid Block Sparks (Chispas F1 de Fondo Plano)
   * Real-time ejection of incandescent titanium micro-particles into the diffuser wake
   * when aerodynamic downforce compresses the floor against the asphalt at high speed.
   */
  public emitUnderbodyTitaniumSparks(
    floorPos: THREE.Vector3,
    rearDir: THREE.Vector3,
    carVelocity: THREE.Vector3,
    dt: number,
    intensity: number = 0.5
  ): void {
    const carSpeed = carVelocity.length();
    if (carSpeed < 12.0) return;

    // Framerate-independent accumulation
    this.sparkSpawnAccumulator += intensity * 190.0 * Math.max(0.001, Math.min(0.05, dt));
    const count = Math.min(14, Math.floor(this.sparkSpawnAccumulator));
    this.sparkSpawnAccumulator -= count;

    for (let i = 0; i < count; i++) {
      let spark: Spark;
      if (this.sparkPool.length > 0) {
        spark = this.sparkPool.pop()!;
      } else if (this.sparks.length < this.maxSparks) {
        spark = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 0 };
      } else {
        spark = this.popOldest(this.sparks)!;
      }

      // Fan-out angle in the aerodynamic ground-effect wake
      const fanAngle = (Math.random() - 0.5) * 0.32;
      const cosA = Math.cos(fanAngle);
      const sinA = Math.sin(fanAngle);
      const sprayDirX = rearDir.x * cosA - rearDir.z * sinA;
      const sprayDirZ = rearDir.x * sinA + rearDir.z * cosA;

      const ejectSpeed = carSpeed * (0.82 + Math.random() * 0.42) + 5.5;

      // Spawn precisely at the titanium skid block keel plane
      spark.position.set(
        floorPos.x + (Math.random() - 0.5) * 0.22,
        Math.max(0.008, floorPos.y + (Math.random() - 0.5) * 0.02),
        floorPos.z + (Math.random() - 0.5) * 0.22
      );

      // Low trajectory skimming the asphalt, then sucked up into the rear diffuser updraft
      spark.velocity.set(
        sprayDirX * ejectSpeed + (Math.random() - 0.5) * 1.6,
        Math.random() * 1.9 + 0.35,
        sprayDirZ * ejectSpeed + (Math.random() - 0.5) * 1.6
      );

      spark.life = 0;
      spark.maxLife = 0.26 + Math.random() * 0.30;
      this.sparks.push(spark);
    }

    // Warm specular road reflection under the floor/diffuser
    this.groundGlowPos.copy(floorPos);
    this.groundGlowIntensity = Math.min(1.0, this.groundGlowIntensity + intensity * 0.45);
  }

  /**
   * Discrete High-Impact Burst on initial barrier collision
   */
  public emitSparks(pos: THREE.Vector3, normal: THREE.Vector3, count: number = 24): void {
    // 1. Dynamic Flash of Incandescent Light on Collision
    if (this.impactLight) {
      this.impactLight.position.copy(pos).addScaledVector(normal, 0.45);
      this.impactLight.intensity = Math.min(12.0, 4.0 + count * 0.20);
    }

    const actualCount = Math.min(count, 32);

    // 2. High-speed incandescent needle sparks
    for (let i = 0; i < actualCount; i++) {
      let spark: Spark;
      if (this.sparkPool.length > 0) {
        spark = this.sparkPool.pop()!;
      } else if (this.sparks.length < this.maxSparks) {
        spark = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 0 };
      } else {
        spark = this.popOldest(this.sparks)!;
      }

      const spread = 0.85;
      const speed = 12.0 + Math.random() * 18.0;
      spark.position.set(
        pos.x + (Math.random() - 0.5) * 0.25,
        pos.y + Math.random() * 0.2,
        pos.z + (Math.random() - 0.5) * 0.25
      );
      const nx = normal.x * 2.2 + (Math.random() - 0.5) * spread;
      const ny = Math.random() * 3.8 + 1.0;
      const nz = normal.z * 2.2 + (Math.random() - 0.5) * spread;
      const len = Math.hypot(nx, ny, nz) || 1.0;
      spark.velocity.set((nx / len) * speed, (ny / len) * speed, (nz / len) * speed);
      spark.life = 0;
      spark.maxLife = 0.35 + Math.random() * 0.55;
      this.sparks.push(spark);
    }

    // 3. Spawn 3D physical carbon fiber shards on collision
    this.emitCarbonDebrisBurst(pos, normal, undefined, Math.min(14, Math.max(3, Math.floor(actualCount / 2))));

    // 4. Trigger Ground Contact Glow & Scorch Mark
    this.groundGlowPos.copy(pos);
    this.groundGlowIntensity = Math.min(1.0, this.groundGlowIntensity + 0.85);
    this.addScorchMark(pos.x, pos.z, 0.28);

    // 5. Impact dust cloud
    this.emitImpactDust(pos, normal);
  }

  /**
   * Emit high-velocity 3D carbon fiber shards & aerodynamic composite debris on violent impacts
   */
  public emitCarbonDebrisBurst(
    pos: THREE.Vector3,
    normal: THREE.Vector3,
    carVel?: THREE.Vector3,
    count: number = 16
  ): void {
    const debrisCount = Math.min(count, this.maxDebris - this.debrisList.length);
    for (let d = 0; d < debrisCount; d++) {
      let shard: DebrisChunk;
      if (this.debrisPool.length > 0) {
        shard = this.debrisPool.pop()!;
      } else if (this.debrisList.length >= this.maxDebris) {
        shard = this.popOldest(this.debrisList)!;
      } else {
        shard = {
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          rotation: new THREE.Vector3(),
          angVel: new THREE.Vector3(),
          life: 0,
          maxLife: 1.0,
        };
      }

      const shardSpeed = 5.5 + Math.random() * 11.0;
      const fwdX = carVel ? carVel.x * 0.40 : 0;
      const fwdY = carVel ? carVel.y * 0.40 : 0;
      const fwdZ = carVel ? carVel.z * 0.40 : 0;

      const rawBx = normal.x * 2.6 + (Math.random() - 0.5) * 3.8;
      const rawBy = 2.6 + Math.random() * 4.8;
      const rawBz = normal.z * 2.6 + (Math.random() - 0.5) * 3.8;
      const bLen = Math.hypot(rawBx, rawBy, rawBz) || 1.0;

      shard.position.set(
        pos.x + (Math.random() - 0.5) * 0.35,
        pos.y + 0.18 + Math.random() * 0.25,
        pos.z + (Math.random() - 0.5) * 0.35
      );
      shard.velocity.set(
        (rawBx / bLen) * shardSpeed + fwdX,
        (rawBy / bLen) * shardSpeed + fwdY,
        (rawBz / bLen) * shardSpeed + fwdZ
      );
      shard.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      shard.angVel.set(
        (Math.random() - 0.5) * 32,
        (Math.random() - 0.5) * 32,
        (Math.random() - 0.5) * 32
      );
      shard.life = 0;
      shard.maxLife = 2.0 + Math.random() * 1.5;

      this.debrisList.push(shard);
    }
  }

  /**
   * Emit compressed air aerosol puffs from pneumatic impact wrenches and air jacks (clean white air blast)
   */
  public emitPneumaticBlast(pos: THREE.Vector3, dir: THREE.Vector3, count: number = 3): void {
    for (let i = 0; i < count; i++) {
      let puff: SmokePuff;
      if (this.smokePool.length > 0) {
        puff = this.smokePool.pop()!;
      } else if (this.smokePuffs.length < this.maxSmoke) {
        puff = {
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          size: 0.22,
          maxSize: 1.1,
          rotation: 0,
          rotationSpeed: 0,
          opacity: 0.85,
          maxOpacity: 0.85,
          life: 0,
          maxLife: 0.35,
          colorR: 0.98,
          colorG: 0.99,
          colorB: 1.0,
          growthExponent: 0.35,
          buoyancy: 0.2,
          drag: 3.5,
        };
      } else {
        puff = this.popOldest(this.smokePuffs)!;
      }

      const speed = 3.2 + Math.random() * 4.2;
      puff.position.set(
        pos.x + (Math.random() - 0.5) * 0.08,
        pos.y + (Math.random() - 0.5) * 0.08,
        pos.z + (Math.random() - 0.5) * 0.08
      );
      puff.velocity.set(
        dir.x * speed + (Math.random() - 0.5) * 0.8,
        dir.y * speed + (Math.random() - 0.5) * 0.8,
        dir.z * speed + (Math.random() - 0.5) * 0.8
      );
      puff.size = 0.22;
      puff.maxSize = 1.1 + Math.random() * 0.4;
      puff.rotation = Math.random() * Math.PI * 2;
      puff.rotationSpeed = (Math.random() - 0.5) * 3.5;
      puff.opacity = 0.85;
      puff.maxOpacity = 0.85;
      puff.life = 0;
      puff.maxLife = 0.35 + Math.random() * 0.18;
      puff.colorR = 0.98;
      puff.colorG = 0.99;
      puff.colorB = 1.0;
      puff.growthExponent = 0.35;
      puff.buoyancy = 0.2;
      puff.drag = 3.5;

      this.smokePuffs.push(puff);
    }
  }

  /**
   * Emit dense cryogenic nitrogen vapor plume from pneumatic wheel gun exhaust valve (40 bar rapid decompression)
   */
  public emitCryogenicNitrogenPlume(pos: THREE.Vector3, dir: THREE.Vector3, count: number = 4): void {
    for (let i = 0; i < count; i++) {
      let puff: SmokePuff;
      if (this.smokePool.length > 0) {
        puff = this.smokePool.pop()!;
      } else if (this.smokePuffs.length < this.maxSmoke) {
        puff = {
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          size: 0.14,
          maxSize: 0.75,
          rotation: 0,
          rotationSpeed: 0,
          opacity: 0.94,
          maxOpacity: 0.94,
          life: 0,
          maxLife: 0.25,
          colorR: 0.92,
          colorG: 0.96,
          colorB: 1.0,
          growthExponent: 0.30,
          buoyancy: 0.3,
          drag: 4.0,
        };
      } else {
        puff = this.popOldest(this.smokePuffs)!;
      }

      const coneSpread = 0.32;
      const speed = 4.8 + Math.random() * 5.2;
      puff.position.set(
        pos.x + (Math.random() - 0.5) * 0.05,
        pos.y + (Math.random() - 0.5) * 0.05,
        pos.z + (Math.random() - 0.5) * 0.05
      );
      puff.velocity.set(
        dir.x * speed + (Math.random() - 0.5) * coneSpread * speed,
        dir.y * speed + (Math.random() - 0.5) * coneSpread * speed + 0.3,
        dir.z * speed + (Math.random() - 0.5) * coneSpread * speed
      );
      puff.size = 0.14;
      puff.maxSize = 0.75 + Math.random() * 0.35;
      puff.rotation = Math.random() * Math.PI * 2;
      puff.rotationSpeed = (Math.random() - 0.5) * 6.0;
      puff.opacity = 0.94;
      puff.maxOpacity = 0.94;
      puff.life = 0;
      puff.maxLife = 0.25 + Math.random() * 0.15;
      puff.colorR = 0.92;
      puff.colorG = 0.96;
      puff.colorB = 1.0;
      puff.growthExponent = 0.30;
      puff.buoyancy = 0.3;
      puff.drag = 4.0;

      this.smokePuffs.push(puff);
    }
  }

  /**
   * Emit razor-sharp golden micro-sparks from wheel hub centerlock torquing (WITHOUT dust)
   */
  public emitNutTorqueSparks(pos: THREE.Vector3, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      let spark: Spark;
      if (this.sparkPool.length > 0) {
        spark = this.sparkPool.pop()!;
      } else if (this.sparks.length < this.maxSparks) {
        spark = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 0 };
      } else {
        spark = this.popOldest(this.sparks)!;
      }

      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 6.5;
      spark.position.set(
        pos.x + (Math.random() - 0.5) * 0.05,
        pos.y + (Math.random() - 0.5) * 0.05,
        pos.z + (Math.random() - 0.5) * 0.05
      );
      spark.velocity.set(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.8 + 1.2,
        (Math.random() - 0.5) * 2.0
      );
      spark.life = 0;
      spark.maxLife = 0.18 + Math.random() * 0.15;

      this.sparks.push(spark);
    }
  }

  /**
   * Emit white/grey dust cloud upon crashing into barrier or ground
   */
  public emitImpactDust(pos: THREE.Vector3, normal: THREE.Vector3): void {
    for (let i = 0; i < 6; i++) {
      let puff: SmokePuff;
      if (this.smokePool.length > 0) {
        puff = this.smokePool.pop()!;
      } else if (this.smokePuffs.length < this.maxSmoke) {
        puff = {
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          size: 0.55,
          maxSize: 3.2,
          rotation: 0,
          rotationSpeed: 0,
          opacity: 0.72,
          maxOpacity: 0.72,
          life: 0,
          maxLife: 0.95,
          colorR: 0.86,
          colorG: 0.86,
          colorB: 0.88,
          growthExponent: 0.42,
          buoyancy: 0.25,
          drag: 1.8,
        };
      } else {
        puff = this.popOldest(this.smokePuffs)!;
      }

      puff.position.set(
        pos.x + (Math.random() - 0.5) * 0.5,
        0.1,
        pos.z + (Math.random() - 0.5) * 0.5
      );
      puff.velocity.set(
        normal.x * 2.2 + (Math.random() - 0.5) * 2.0,
        0.9 + Math.random() * 1.6,
        normal.z * 2.2 + (Math.random() - 0.5) * 2.0
      );
      puff.size = 0.55;
      puff.maxSize = 3.2 + Math.random() * 1.6;
      puff.rotation = Math.random() * Math.PI * 2;
      puff.rotationSpeed = (Math.random() - 0.5) * 1.8;
      puff.opacity = 0.72;
      puff.maxOpacity = 0.72;
      puff.life = 0;
      puff.maxLife = 0.95 + Math.random() * 0.6;
      puff.colorR = 0.86;
      puff.colorG = 0.86;
      puff.colorB = 0.88;
      puff.growthExponent = 0.42;
      puff.buoyancy = 0.25;
      puff.drag = 1.8;

      this.smokePuffs.push(puff);
    }
  }

  /**
   * Emit billowing tire smoke during drift, burnout, or hard braking
   * Ejects smoke with real tire tangential velocity and aerodynamic wake turbulence
   */
  public emitTireSmoke(
    pos: THREE.Vector3,
    count: number = 3,
    slipRatio: number = 0.5,
    tireVelocity?: THREE.Vector3
  ): void {
    const opacityFactor = Math.min(0.96, 0.55 + slipRatio * 0.42);

    for (let i = 0; i < count; i++) {
      let puff: SmokePuff;
      if (this.smokePool.length > 0) {
        puff = this.smokePool.pop()!;
      } else if (this.smokePuffs.length < this.maxSmoke) {
        puff = {
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          size: 0.45,
          maxSize: 3.4,
          rotation: 0,
          rotationSpeed: 0,
          opacity: opacityFactor,
          maxOpacity: opacityFactor,
          life: 0,
          maxLife: 1.2,
          colorR: 0.95,
          colorG: 0.95,
          colorB: 0.97,
          growthExponent: 0.45,
          buoyancy: 0.35,
          drag: 1.4,
        };
      } else {
        puff = this.popOldest(this.smokePuffs)!;
      }

      // Tire tangential velocity + turbulent scatter
      const vx = tireVelocity
        ? tireVelocity.x * (0.35 + Math.random() * 0.35) + (Math.random() - 0.5) * 1.4
        : (Math.random() - 0.5) * 1.4;
      const vz = tireVelocity
        ? tireVelocity.z * (0.35 + Math.random() * 0.35) + (Math.random() - 0.5) * 1.4
        : (Math.random() - 0.5) * 1.4;
      const vy = 0.35 + Math.random() * 0.85 + slipRatio * 0.6;

      const isBasePlume = i === 0 && Math.random() < 0.65;

      puff.position.set(
        pos.x + (Math.random() - 0.5) * 0.32,
        0.04 + Math.random() * 0.06,
        pos.z + (Math.random() - 0.5) * 0.32
      );
      puff.velocity.set(vx, vy, vz);

      if (isBasePlume) {
        // Concentrated hot high-density vapor at contact patch
        puff.size = 0.28 + Math.random() * 0.22;
        puff.maxSize = 2.4 + Math.random() * 1.2 + slipRatio * 1.2;
        puff.growthExponent = 0.38; // rapid early thermal expansion
        puff.maxLife = 0.85 + Math.random() * 0.55;
        puff.maxOpacity = Math.min(0.98, opacityFactor * 1.15);
        puff.buoyancy = 0.55 + Math.random() * 0.4;
        puff.drag = 2.0;
        puff.colorR = 0.96;
        puff.colorG = 0.96;
        puff.colorB = 0.98;
      } else {
        // Dispersed volumetric swirling cloud
        puff.size = 0.55 + Math.random() * 0.45;
        puff.maxSize = 3.6 + Math.random() * 2.2 + slipRatio * 1.8;
        puff.growthExponent = 0.52;
        puff.maxLife = 1.2 + Math.random() * 0.8;
        puff.maxOpacity = opacityFactor * 0.88;
        puff.buoyancy = 0.28 + Math.random() * 0.32;
        puff.drag = 1.1;
        puff.colorR = 0.93;
        puff.colorG = 0.93;
        puff.colorB = 0.95;
      }

      puff.rotation = Math.random() * Math.PI * 2;
      puff.rotationSpeed = (Math.random() - 0.5) * 2.6;
      puff.opacity = 0;
      puff.life = 0;

      this.smokePuffs.push(puff);
    }
  }

  /**
   * Emit seamless sub-frame interpolated continuous tire smoke trail without discrete gaps
   */
  public emitContinuousTireSmoke(
    wheelIdx: number,
    currentPos: THREE.Vector3,
    slipRatio: number,
    tireVelocity?: THREE.Vector3,
    _carSpeedKmh: number = 0,
    isBurnout: boolean = false
  ): void {
    if (slipRatio < 0.16 && !isBurnout) {
      this.lastTireSmokeActive[wheelIdx] = false;
      return;
    }

    if (!this.lastTireSmokeActive[wheelIdx]) {
      this.lastTireSmokePositions[wheelIdx].copy(currentPos);
      this.lastTireSmokeActive[wheelIdx] = true;
      this.emitTireSmoke(currentPos, isBurnout ? 3 : 2, slipRatio, tireVelocity);
      return;
    }

    const lastPos = this.lastTireSmokePositions[wheelIdx];
    const dist = currentPos.distanceTo(lastPos);

    if (dist < 0.08) {
      if (isBurnout || slipRatio > 0.35) {
        this.emitTireSmoke(currentPos, isBurnout ? 3 : 2, slipRatio, tireVelocity);
      }
      return;
    }

    // Sub-frame interpolation steps (every ~0.20 meters of tire displacement)
    const stepDist = 0.20;
    const steps = Math.min(5, Math.max(1, Math.floor(dist / stepDist)));

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      this._scratchVec1.lerpVectors(lastPos, currentPos, t);
      this.emitTireSmoke(this._scratchVec1, isBurnout ? 2 : 1, slipRatio, tireVelocity);
    }

    this.lastTireSmokePositions[wheelIdx].copy(currentPos);
  }

  public breakTireSmokeTrail(wheelIdx?: number): void {
    if (wheelIdx !== undefined) {
      this.lastTireSmokeActive[wheelIdx] = false;
    } else {
      for (let w = 0; w < 4; w++) this.lastTireSmokeActive[w] = false;
    }
  }

  /**
   * Emit realistic exhaust smoke and backfire plumes
   */
  public emitRealisticExhaust(
    pos: THREE.Vector3,
    rearDir: THREE.Vector3,
    mode: 'idle' | 'power' | 'backfire'
  ): void {
    if (mode === 'idle') {
      let puff: SmokePuff;
      if (this.smokePool.length > 0) {
        puff = this.smokePool.pop()!;
      } else if (this.smokePuffs.length < this.maxSmoke) {
        puff = {
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          size: 0.12,
          maxSize: 0.55,
          rotation: 0,
          rotationSpeed: 0,
          opacity: 0.35,
          maxOpacity: 0.35,
          life: 0,
          maxLife: 0.55,
          colorR: 0.88,
          colorG: 0.92,
          colorB: 0.96,
          growthExponent: 0.45,
          buoyancy: 0.4,
          drag: 1.5,
        };
      } else {
        puff = this.popOldest(this.smokePuffs)!;
      }

      puff.position.set(
        pos.x + (Math.random() - 0.5) * 0.05,
        pos.y + (Math.random() - 0.5) * 0.03,
        pos.z + (Math.random() - 0.5) * 0.05
      );
      puff.velocity.set(
        rearDir.x * 0.35 + (Math.random() - 0.5) * 0.15,
        0.32 + Math.random() * 0.22,
        rearDir.z * 0.35 + (Math.random() - 0.5) * 0.15
      );
      puff.size = 0.12;
      puff.maxSize = 0.55 + Math.random() * 0.2;
      puff.rotation = Math.random() * Math.PI * 2;
      puff.rotationSpeed = (Math.random() - 0.5) * 1.4;
      puff.opacity = 0.35;
      puff.maxOpacity = 0.35;
      puff.life = 0;
      puff.maxLife = 0.55 + Math.random() * 0.25;
      puff.colorR = 0.88;
      puff.colorG = 0.92;
      puff.colorB = 0.96;
      puff.growthExponent = 0.45;
      puff.buoyancy = 0.4;
      puff.drag = 1.5;

      this.smokePuffs.push(puff);
    } else if (mode === 'power') {
      let puff: SmokePuff;
      if (this.smokePool.length > 0) {
        puff = this.smokePool.pop()!;
      } else if (this.smokePuffs.length < this.maxSmoke) {
        puff = {
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          size: 0.16,
          maxSize: 0.85,
          rotation: 0,
          rotationSpeed: 0,
          opacity: 0.42,
          maxOpacity: 0.42,
          life: 0,
          maxLife: 0.35,
          colorR: 0.72,
          colorG: 0.75,
          colorB: 0.80,
          growthExponent: 0.38,
          buoyancy: 0.5,
          drag: 2.2,
        };
      } else {
        puff = this.popOldest(this.smokePuffs)!;
      }

      const speed = 5.5 + Math.random() * 4.0;
      puff.position.set(
        pos.x + (Math.random() - 0.5) * 0.04,
        pos.y + (Math.random() - 0.5) * 0.04,
        pos.z + (Math.random() - 0.5) * 0.04
      );
      puff.velocity.set(
        rearDir.x * speed + (Math.random() - 0.5) * 0.25,
        rearDir.y * speed + 0.15,
        rearDir.z * speed + (Math.random() - 0.5) * 0.25
      );
      puff.size = 0.16;
      puff.maxSize = 0.85 + Math.random() * 0.35;
      puff.rotation = Math.random() * Math.PI * 2;
      puff.rotationSpeed = (Math.random() - 0.5) * 3.5;
      puff.opacity = 0.42;
      puff.maxOpacity = 0.42;
      puff.life = 0;
      puff.maxLife = 0.35 + Math.random() * 0.18;
      puff.colorR = 0.72;
      puff.colorG = 0.75;
      puff.colorB = 0.80;
      puff.growthExponent = 0.38;
      puff.buoyancy = 0.5;
      puff.drag = 2.2;

      this.smokePuffs.push(puff);
    } else if (mode === 'backfire') {
      // Hot turbulent dark unburnt fuel soot puffs
      for (let i = 0; i < 2; i++) {
        let puff: SmokePuff;
        if (this.smokePool.length > 0) {
          puff = this.smokePool.pop()!;
        } else if (this.smokePuffs.length < this.maxSmoke) {
          puff = {
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            size: 0.32,
            maxSize: 1.5,
            rotation: 0,
            rotationSpeed: 0,
            opacity: 0.92,
            maxOpacity: 0.92,
            life: 0,
            maxLife: 0.45,
            colorR: 0.14,
            colorG: 0.14,
            colorB: 0.16,
            growthExponent: 0.35,
            buoyancy: 0.6,
            drag: 2.5,
          };
        } else {
          puff = this.popOldest(this.smokePuffs)!;
        }

        puff.position.set(
          pos.x + (Math.random() - 0.5) * 0.08,
          pos.y + (Math.random() - 0.5) * 0.08,
          pos.z + (Math.random() - 0.5) * 0.08
        );
        puff.velocity.set(
          rearDir.x * (9.5 + Math.random() * 6.5) + (Math.random() - 0.5) * 0.8,
          0.55 + Math.random() * 0.55,
          rearDir.z * (9.5 + Math.random() * 6.5) + (Math.random() - 0.5) * 0.8
        );
        puff.size = 0.32;
        puff.maxSize = 1.5 + Math.random() * 0.5;
        puff.rotation = Math.random() * Math.PI * 2;
        puff.rotationSpeed = (Math.random() - 0.5) * 5.0;
        puff.opacity = 0.92;
        puff.maxOpacity = 0.92;
        puff.life = 0;
        puff.maxLife = 0.45 + Math.random() * 0.22;
        puff.colorR = 0.14;
        puff.colorG = 0.14;
        puff.colorB = 0.16;
        puff.growthExponent = 0.35;
        puff.buoyancy = 0.6;
        puff.drag = 2.5;

        this.smokePuffs.push(puff);
      }

      // Burning liquid fuel droplet needle tracers
      for (let s = 0; s < 8; s++) {
        let spark: Spark;
        if (this.sparkPool.length > 0) {
          spark = this.sparkPool.pop()!;
        } else if (this.sparks.length < this.maxSparks) {
          spark = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 0 };
        } else {
          spark = this.popOldest(this.sparks)!;
        }

        const dropletSpeed = 16.0 + Math.random() * 18.0;
        spark.position.set(
          pos.x + (Math.random() - 0.5) * 0.05,
          pos.y + (Math.random() - 0.5) * 0.05,
          pos.z + (Math.random() - 0.5) * 0.05
        );
        spark.velocity.set(
          rearDir.x * dropletSpeed + (Math.random() - 0.5) * 2.2,
          0.4 + Math.random() * 1.5,
          rearDir.z * dropletSpeed + (Math.random() - 0.5) * 2.2
        );
        spark.life = 0;
        spark.maxLife = 0.16 + Math.random() * 0.14;

        this.sparks.push(spark);
      }
    }
  }

  /**
   * Emit progressive engine damage smoke from the hood
   */
  public emitEngineDamageSmoke(pos: THREE.Vector3, engineHealth: number): void {
    const isSevere = engineHealth < 35;
    const isCritical = engineHealth < 20;

    let r = 0.5;
    let g = 0.5;
    let b = 0.52;

    if (isCritical) {
      r = 0.08;
      g = 0.08;
      b = 0.09;
    } else if (isSevere) {
      r = 0.18;
      g = 0.18;
      b = 0.20;
    }

    let puff: SmokePuff;
    if (this.smokePool.length > 0) {
      puff = this.smokePool.pop()!;
    } else if (this.smokePuffs.length < this.maxSmoke) {
      puff = {
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        size: 0.65,
        maxSize: 3.2,
        rotation: 0,
        rotationSpeed: 0,
        opacity: 0.65,
        maxOpacity: 0.65,
        life: 0,
        maxLife: 1.4,
        colorR: r,
        colorG: g,
        colorB: b,
        growthExponent: 0.48,
        buoyancy: 0.8,
        drag: 1.2,
      };
    } else {
      puff = this.popOldest(this.smokePuffs)!;
    }

    puff.position.set(
      pos.x + (Math.random() - 0.5) * 0.4,
      0.25,
      pos.z + (Math.random() - 0.5) * 0.4
    );
    puff.velocity.set(
      (Math.random() - 0.5) * 0.6,
      1.8 + Math.random() * 1.4,
      (Math.random() - 0.5) * 0.6
    );
    puff.size = 0.65;
    puff.maxSize = isSevere ? 4.2 : 3.0;
    puff.rotation = Math.random() * Math.PI * 2;
    puff.rotationSpeed = (Math.random() - 0.5) * 2.2;
    puff.opacity = isSevere ? 0.94 : 0.65;
    puff.maxOpacity = isSevere ? 0.94 : 0.65;
    puff.life = 0;
    puff.maxLife = 1.4 + Math.random() * 0.8;
    puff.colorR = r;
    puff.colorG = g;
    puff.colorB = b;
    puff.growthExponent = 0.48;
    puff.buoyancy = 0.8 + (isCritical ? 0.6 : 0.2);
    puff.drag = 1.2;

    this.smokePuffs.push(puff);

    if (isCritical && Math.random() < 0.40) {
      let spark: Spark;
      if (this.sparkPool.length > 0) {
        spark = this.sparkPool.pop()!;
      } else if (this.sparks.length < this.maxSparks) {
        spark = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 0 };
      } else {
        spark = this.popOldest(this.sparks)!;
      }

      spark.position.set(
        pos.x + (Math.random() - 0.5) * 0.3,
        0.3,
        pos.z + (Math.random() - 0.5) * 0.3
      );
      spark.velocity.set(
        (Math.random() - 0.5) * 2.5,
        3.5 + Math.random() * 2.5,
        (Math.random() - 0.5) * 2.5
      );
      spark.life = 0;
      spark.maxLife = 0.4 + Math.random() * 0.3;

      this.sparks.push(spark);
    }
  }

  /**
   * Add continuous independent tire skidmarks on the road surface for all 4 wheels [FL, FR, RL, RR]
   */
  public addFourWheelSkidmarks(
    wheels: THREE.Vector3[],
    slips: number[],
    forwardDir: THREE.Vector3
  ): void {
    const roadY = 0.024;
    const perpX = -forwardDir.z;
    const perpZ = forwardDir.x;

    let minModifiedIndex = Infinity;
    let maxModifiedIndex = -1;

    for (let w = 0; w < 4; w++) {
      const wheelPos = wheels[w];
      const slip = slips[w] || 0;

      if (slip < 0.16) {
        this.lastWheelActive[w] = false;
        continue;
      }

      if (!this.lastWheelActive[w]) {
        this.lastWheelPositions[w].copy(wheelPos);
        this.lastWheelActive[w] = true;
        continue;
      }

      const lastPos = this.lastWheelPositions[w];

      const dist = wheelPos.distanceTo(lastPos);
      if (dist < 0.22) continue;

      // Tire half width (front 0.14m, rear 0.18m) with lateral squish deformation
      const baseWidth = w < 2 ? 0.13 : 0.17;
      const widthSquish = baseWidth * (1.0 + Math.min(0.35, slip * 0.4));

      const hx = perpX * widthSquish;
      const hz = perpZ * widthSquish;

      this._skidP1.set(lastPos.x - hx, roadY, lastPos.z - hz);
      this._skidP2.set(lastPos.x + hx, roadY, lastPos.z + hz);
      this._skidP3.set(wheelPos.x + hx, roadY, wheelPos.z + hz);
      this._skidP4.set(wheelPos.x - hx, roadY, wheelPos.z - hz);

      const baseIndex = (this.skidIndex % this.maxSkidPoints) * 6;
      if (baseIndex < minModifiedIndex) minModifiedIndex = baseIndex;
      if (baseIndex + 5 > maxModifiedIndex) maxModifiedIndex = baseIndex + 5;

      // High-density carbon deposit on heavy slip
      const alpha = Math.min(0.85, Math.max(0.12, (slip - 0.12) * 1.1));

      // Direct zero-allocation writes for 6 quad vertices (P1, P2, P3, P1, P3, P4)
      const p1 = this._skidP1, p2 = this._skidP2, p3 = this._skidP3, p4 = this._skidP4;
      const v0 = (baseIndex) * 3;
      this.skidPositions[v0] = p1.x; this.skidPositions[v0 + 1] = p1.y; this.skidPositions[v0 + 2] = p1.z;
      const v1 = (baseIndex + 1) * 3;
      this.skidPositions[v1] = p2.x; this.skidPositions[v1 + 1] = p2.y; this.skidPositions[v1 + 2] = p2.z;
      const v2 = (baseIndex + 2) * 3;
      this.skidPositions[v2] = p3.x; this.skidPositions[v2 + 1] = p3.y; this.skidPositions[v2 + 2] = p3.z;
      const v3 = (baseIndex + 3) * 3;
      this.skidPositions[v3] = p1.x; this.skidPositions[v3 + 1] = p1.y; this.skidPositions[v3 + 2] = p1.z;
      const v4 = (baseIndex + 4) * 3;
      this.skidPositions[v4] = p3.x; this.skidPositions[v4 + 1] = p3.y; this.skidPositions[v4 + 2] = p3.z;
      const v5 = (baseIndex + 5) * 3;
      this.skidPositions[v5] = p4.x; this.skidPositions[v5 + 1] = p4.y; this.skidPositions[v5 + 2] = p4.z;

      for (let i = 0; i < 6; i++) {
        const colIdx = (baseIndex + i) * 4;
        this.skidAlphas[colIdx] = 0.05;
        this.skidAlphas[colIdx + 1] = 0.05;
        this.skidAlphas[colIdx + 2] = 0.06;
        this.skidAlphas[colIdx + 3] = alpha;
      }

      this.skidIndex++;
      this.lastWheelPositions[w]!.copy(wheelPos);
    }

    // Only upload modified range across PCIe bus if new skid vertices were actually stamped
    if (maxModifiedIndex >= 0) {
      const posAttr = this.skidMesh.geometry.attributes.position as THREE.BufferAttribute;
      const colAttr = this.skidMesh.geometry.attributes.color as THREE.BufferAttribute;
      const vertCount = maxModifiedIndex - minModifiedIndex + 1;
      posAttr.clearUpdateRanges();
      posAttr.addUpdateRange(minModifiedIndex * 3, vertCount * 3);
      posAttr.needsUpdate = true;

      colAttr.clearUpdateRanges();
      colAttr.addUpdateRange(minModifiedIndex * 4, vertCount * 4);
      colAttr.needsUpdate = true;
    }
  }

  /**
   * Add continuous tire skidmarks on the road surface (2-wheel fallback)
   */
  public addSkidmark(leftWheel: THREE.Vector3, rightWheel: THREE.Vector3, intensity: number): void {
    if (!this.lastLeftWheelPos || !this.lastRightWheelPos) {
      this.lastLeftWheelPos = new THREE.Vector3().copy(leftWheel);
      this.lastRightWheelPos = new THREE.Vector3().copy(rightWheel);
      return;
    }

    const dist = leftWheel.distanceTo(this.lastLeftWheelPos);
    if (dist < 0.3) return;

    const tireHalfWidth = 0.16;
    const roadY = 0.024;

    this._skidP1.set(this.lastLeftWheelPos.x - tireHalfWidth, roadY, this.lastLeftWheelPos.z);
    this._skidP2.set(this.lastLeftWheelPos.x + tireHalfWidth, roadY, this.lastLeftWheelPos.z);
    this._skidP3.set(leftWheel.x + tireHalfWidth, roadY, leftWheel.z);
    this._skidP4.set(leftWheel.x - tireHalfWidth, roadY, leftWheel.z);

    const quadVerts = [this._skidP1, this._skidP2, this._skidP3, this._skidP1, this._skidP3, this._skidP4];
    const baseIndex = (this.skidIndex % this.maxSkidPoints) * 6;
    const alpha = Math.min(0.82, intensity * 0.85);

    for (let i = 0; i < 6; i++) {
      const v = quadVerts[i];
      const vertIdx = (baseIndex + i) * 3;
      this.skidPositions[vertIdx] = v.x;
      this.skidPositions[vertIdx + 1] = v.y;
      this.skidPositions[vertIdx + 2] = v.z;

      const colIdx = (baseIndex + i) * 4;
      this.skidAlphas[colIdx] = 0.05;
      this.skidAlphas[colIdx + 1] = 0.05;
      this.skidAlphas[colIdx + 2] = 0.06;
      this.skidAlphas[colIdx + 3] = alpha;
    }

    this.skidIndex++;
    const posAttr = this.skidMesh.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.skidMesh.geometry.attributes.color as THREE.BufferAttribute;
    posAttr.clearUpdateRanges();
    posAttr.addUpdateRange(baseIndex * 3, 18);
    posAttr.needsUpdate = true;

    colAttr.clearUpdateRanges();
    colAttr.addUpdateRange(baseIndex * 4, 24);
    colAttr.needsUpdate = true;

    this.lastLeftWheelPos.copy(leftWheel);
    this.lastRightWheelPos.copy(rightWheel);
  }

  public breakSkidmark(): void {
    this.lastLeftWheelPos = null;
    this.lastRightWheelPos = null;
    for (let i = 0; i < 4; i++) {
      this.lastWheelActive[i] = false;
    }
  }

  /**
   * Main Particle Simulation Frame Tick (High performance: zero splice, conditional buffer updates)
   * @param dt delta time in seconds
   * @param carPos optional vehicle position for aerodynamic slipstream wake computation
   * @param carForward optional vehicle forward vector
   * @param carVelocity optional vehicle velocity vector
   */
  public update(
    dt: number,
    carPos?: THREE.Vector3,
    carForward?: THREE.Vector3,
    carVelocity?: THREE.Vector3
  ): void {
    const hasCarAero = Boolean(carPos && carForward && carVelocity && carVelocity.lengthSq() > 4.0);
    const carSpeed = hasCarAero ? carVelocity!.length() : 0;
    const carRightX = hasCarAero ? -carForward!.z : 0;
    const carRightZ = hasCarAero ? carForward!.x : 0;

    // --- 1. Update Camera-Facing Velocity Ribbons & Slipstream Vortices ---
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      if (s.life >= s.maxLife) {
        this.sparkPool.push(s);
        this.sparks[i] = this.sparks[this.sparks.length - 1];
        this.sparks.pop();
        continue;
      }

      // Module 3: Aerodynamic Slipstream & Wake Vortices Interaction
      if (hasCarAero) {
        const dx = s.position.x - carPos!.x;
        const dz = s.position.z - carPos!.z;
        const localZ = dx * carForward!.x + dz * carForward!.z; // along heading
        const localX = dx * carRightX + dz * carRightZ; // across width

        // If spark is in the car's aerodynamic envelope (near flanks or behind diffuser)
        if (localZ > -5.5 && localZ < 1.2 && Math.abs(localX) < 3.2) {
          const wakeFactor = Math.exp(-(localZ * localZ) / 10.0);
          
          // Inward Venturi suction towards vehicle centerline
          const suction = -Math.sign(localX) * carSpeed * 2.4 * wakeFactor * dt;
          s.velocity.x += carRightX * suction;
          s.velocity.z += carRightZ * suction;

          // Forward wake drag entrainment
          const wakeDrag = carSpeed * 0.36 * wakeFactor * dt;
          s.velocity.x += carForward!.x * wakeDrag;
          s.velocity.z += carForward!.z * wakeDrag;

          // Diffuser / Wing Upwash vortex swirl
          s.velocity.y += carSpeed * 0.12 * wakeFactor * dt;
        }
      }

      // Ballistic gravity & air drag
      s.velocity.y -= 14.5 * dt;
      s.velocity.x *= Math.max(0, 1.0 - 0.35 * dt);
      s.velocity.z *= Math.max(0, 1.0 - 0.35 * dt);
      s.position.addScaledVector(s.velocity, dt);

      // Bounce on tarmac with realistic friction and restitution
      if (s.position.y < 0.03) {
        s.position.y = 0.03;
        s.velocity.y *= -0.42;
        s.velocity.x *= 0.74;
        s.velocity.z *= 0.74;

        // Ground contact scorch probability
        if (Math.random() < 0.08 && Math.abs(s.velocity.y) > 0.8) {
          this.addScorchMark(s.position.x, s.position.z, 0.14);
        }
      }
    }

    // Upload Instanced Spark Attributes to GPU (Only if there are active sparks or previous ones to clear)
    const activeSparks = this.sparks.length;
    if (activeSparks > 0 || this.prevActiveSparks > 0) {
      const updateLimit = Math.max(activeSparks, this.prevActiveSparks);
      for (let i = 0; i < updateLimit; i++) {
        const pIdx = i * 3;
        const lIdx = i * 2;

        if (i < activeSparks) {
          const s = this.sparks[i];
          this.sparkInstPos[pIdx] = s.position.x;
          this.sparkInstPos[pIdx + 1] = s.position.y;
          this.sparkInstPos[pIdx + 2] = s.position.z;

          this.sparkInstVel[pIdx] = s.velocity.x;
          this.sparkInstVel[pIdx + 1] = s.velocity.y;
          this.sparkInstVel[pIdx + 2] = s.velocity.z;

          this.sparkInstLife[lIdx] = s.life;
          this.sparkInstLife[lIdx + 1] = s.maxLife;
        } else {
          this.sparkInstPos[pIdx] = 0;
          this.sparkInstPos[pIdx + 1] = -99999;
          this.sparkInstPos[pIdx + 2] = 0;

          this.sparkInstVel[pIdx] = 0;
          this.sparkInstVel[pIdx + 1] = 0;
          this.sparkInstVel[pIdx + 2] = 0;

          this.sparkInstLife[lIdx] = 1.0;
          this.sparkInstLife[lIdx + 1] = 0.0;
        }
      }
      const posAttr = this.sparkInstGeo.getAttribute('aInstancePos') as THREE.InstancedBufferAttribute;
      const velAttr = this.sparkInstGeo.getAttribute('aInstanceVel') as THREE.InstancedBufferAttribute;
      const lifeAttr = this.sparkInstGeo.getAttribute('aInstanceLife') as THREE.InstancedBufferAttribute;

      posAttr.clearUpdateRanges();
      posAttr.addUpdateRange(0, updateLimit * 3);
      posAttr.needsUpdate = true;

      velAttr.clearUpdateRanges();
      velAttr.addUpdateRange(0, updateLimit * 3);
      velAttr.needsUpdate = true;

      lifeAttr.clearUpdateRanges();
      lifeAttr.addUpdateRange(0, updateLimit * 2);
      lifeAttr.needsUpdate = true;
    }
    this.prevActiveSparks = activeSparks;

    // --- 2. Update 3D Carbon Fiber Shards ---
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.life += dt;
      if (d.life >= d.maxLife) {
        this.debrisPool.push(d);
        this.debrisList[i] = this.debrisList[this.debrisList.length - 1];
        this.debrisList.pop();
        continue;
      }

      // Aerodynamic wake entrainment on carbon shards
      if (hasCarAero) {
        const dx = d.position.x - carPos!.x;
        const dz = d.position.z - carPos!.z;
        const localZ = dx * carForward!.x + dz * carForward!.z;
        if (localZ > -4.5 && localZ < 0.5) {
          const wakeFactor = Math.exp(-(localZ * localZ) / 8.0);
          d.velocity.x += carForward!.x * carSpeed * 0.22 * wakeFactor * dt;
          d.velocity.z += carForward!.z * carSpeed * 0.22 * wakeFactor * dt;
        }
      }

      d.velocity.y -= 13.5 * dt;
      d.position.addScaledVector(d.velocity, dt);

      d.rotation.x += d.angVel.x * dt;
      d.rotation.y += d.angVel.y * dt;
      d.rotation.z += d.angVel.z * dt;

      if (d.position.y < 0.02) {
        d.position.y = 0.02;
        d.velocity.y *= -0.32;
        d.velocity.x *= 0.68;
        d.velocity.z *= 0.68;
        d.angVel.multiplyScalar(0.72);
      }
    }

    if (this.debrisList.length > 0 || this.prevActiveDebris > 0) {
      const maxActive = Math.max(this.debrisList.length, this.prevActiveDebris);
      for (let i = 0; i < maxActive; i++) {
        if (i < this.debrisList.length) {
          const d = this.debrisList[i];
          const fadeProgress = d.life / d.maxLife;
          const scale = Math.max(0.01, 1.0 - Math.pow(fadeProgress, 3) * 0.6);
          this._debrisScale.set(scale, scale, scale);

          this._debrisEuler.set(d.rotation.x, d.rotation.y, d.rotation.z);
          this._debrisQuat.setFromEuler(this._debrisEuler);

          this._debrisMatrix.compose(d.position, this._debrisQuat, this._debrisScale);
          this.debrisMesh.setMatrixAt(i, this._debrisMatrix);
        } else {
          this._debrisScale.set(0, 0, 0);
          this._debrisMatrix.makeScale(0, 0, 0);
          this._debrisMatrix.setPosition(0, -999, 0);
          this.debrisMesh.setMatrixAt(i, this._debrisMatrix);
        }
      }
      this.debrisMesh.count = this.debrisList.length;
      this.debrisMesh.instanceMatrix.needsUpdate = true;
    }
    this.prevActiveDebris = this.debrisList.length;

    // --- 3. Update Impact Point Light & Specular Ground Glow ---
    if (this.impactLight && this.impactLight.intensity > 0.01) {
      this.impactLight.intensity = Math.max(0, this.impactLight.intensity - dt * 32.0);
    }

    if (this.groundGlowIntensity > 0.01) {
      this.groundGlowIntensity = Math.max(0, this.groundGlowIntensity - dt * 2.8);
      this.groundGlowMesh.visible = true;
      this.groundGlowMesh.position.set(this.groundGlowPos.x, 0.012, this.groundGlowPos.z);
      this.groundGlowMaterial.opacity = Math.min(0.85, this.groundGlowIntensity * 0.85);
    } else {
      this.groundGlowMesh.visible = false;
    }

    // --- 4. Update Tarmac Scorch Marks (Smooth Alpha Fade-Out) ---
    for (let i = this.scorchList.length - 1; i >= 0; i--) {
      const sc = this.scorchList[i];
      sc.life += dt;
      if (sc.life >= sc.maxLife) {
        this.scorchPool.push(sc);
        this.scorchList[i] = this.scorchList[this.scorchList.length - 1];
        this.scorchList.pop();
      }
    }

    if (this.scorchList.length > 0 || this.prevActiveScorches > 0) {
      const maxActive = Math.max(this.scorchList.length, this.prevActiveScorches);
      for (let i = 0; i < maxActive; i++) {
        if (i < this.scorchList.length) {
          const sc = this.scorchList[i];
          const fade = Math.max(0, 1.0 - sc.life / sc.maxLife);
          const currentRadius = sc.radius * (0.9 + 0.1 * fade);

          this._scorchScale.set(currentRadius * 2, currentRadius * 2, 1);
          this._scorchEuler.set(-Math.PI / 2, 0, sc.rotation);
          this._scorchQuat.setFromEuler(this._scorchEuler);

          this._scorchPos.set(sc.x, 0.008, sc.z);
          this._scorchMatrix.compose(
            this._scorchPos,
            this._scorchQuat,
            this._scorchScale
          );
          this.scorchMesh.setMatrixAt(i, this._scorchMatrix);
        } else {
          this._scorchScale.set(0, 0, 0);
          this._scorchMatrix.makeScale(0, 0, 0);
          this._scorchMatrix.setPosition(0, -999, 0);
          this.scorchMesh.setMatrixAt(i, this._scorchMatrix);
        }
      }
      this.scorchMesh.count = this.scorchList.length;
      this.scorchMesh.instanceMatrix.needsUpdate = true;
    }
    this.prevActiveScorches = this.scorchList.length;

    // --- 5. Update Volumetric Smoke Puffs (GPU Instanced Attributes) ---
    for (let i = this.smokePuffs.length - 1; i >= 0; i--) {
      const p = this.smokePuffs[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.smokePool.push(p);
        this.smokePuffs[i] = this.smokePuffs[this.smokePuffs.length - 1];
        this.smokePuffs.pop();
        continue;
      }

      // Aerodynamic wake entrainment on smoke clouds
      if (hasCarAero) {
        const dx = p.position.x - carPos!.x;
        const dz = p.position.z - carPos!.z;
        const localZ = dx * carForward!.x + dz * carForward!.z;
        const localX = dx * carRightX + dz * carRightZ;

        if (localZ > -6.0 && localZ < 1.0 && Math.abs(localX) < 3.0) {
          const wakeFactor = Math.exp(-(localZ * localZ) / 12.0);
          p.velocity.x += -Math.sign(localX) * carSpeed * 0.8 * wakeFactor * dt;
          p.velocity.z += -Math.sign(localX) * carSpeed * 0.8 * wakeFactor * dt;
          p.velocity.x += carForward!.x * carSpeed * 0.18 * wakeFactor * dt;
          p.velocity.z += carForward!.z * carSpeed * 0.18 * wakeFactor * dt;
          p.velocity.y += carSpeed * 0.08 * wakeFactor * dt;
        }
      }

      // Air resistance and thermal buoyancy
      const dragFactor = Math.max(0, 1.0 - (p.drag || 1.3) * dt);
      p.velocity.x *= dragFactor;
      p.velocity.z *= dragFactor;
      p.velocity.y += (p.buoyancy || 0.35) * dt;
      p.position.addScaledVector(p.velocity, dt);

      // Floor boundary with gentle deceleration
      if (p.position.y < 0.02) {
        p.position.y = 0.02;
        p.velocity.y = Math.max(0, p.velocity.y * 0.5);
      }

      p.rotation += p.rotationSpeed * dt;
    }

    const activeSmoke = this.smokePuffs.length;
    this.smokeTime += dt;
    if (this.smokeMaterial && this.smokeMaterial.uniforms.uTime) {
      this.smokeMaterial.uniforms.uTime.value = this.smokeTime;
    }
    if (activeSmoke > 0 || this.prevActiveSmoke > 0) {
      const updateLimit = Math.max(activeSmoke, this.prevActiveSmoke);
      for (let i = 0; i < updateLimit; i++) {
        const pIdx = i * 3;
        const paramIdx = i * 4;
        const colIdx = i * 4;
        const vIdx = i * 3;

        if (i < activeSmoke) {
          const p = this.smokePuffs[i];
          this.smokeInstPos[pIdx] = p.position.x;
          this.smokeInstPos[pIdx + 1] = p.position.y;
          this.smokeInstPos[pIdx + 2] = p.position.z;

          const progress = p.life / p.maxLife;

          // Non-linear volumetric expansion: fast thermal pop, steady billow
          const growth = Math.pow(progress, p.growthExponent || 0.45);
          const currentSize = p.size + (p.maxSize - p.size) * growth;

          // Smooth attack / sustain / cubic fade-out
          let opacityEnvelope: number;
          if (progress < 0.10) {
            opacityEnvelope = (progress / 0.10);
          } else if (progress < 0.45) {
            opacityEnvelope = 1.0;
          } else {
            const decayT = (progress - 0.45) / 0.55;
            opacityEnvelope = Math.pow(1.0 - decayT, 1.6);
          }
          const currentOpacity = p.maxOpacity * opacityEnvelope;

          this.smokeInstParams[paramIdx] = currentSize;
          this.smokeInstParams[paramIdx + 1] = p.rotation;
          this.smokeInstParams[paramIdx + 2] = currentOpacity;
          this.smokeInstParams[paramIdx + 3] = progress;

          this.smokeInstColor[colIdx] = p.colorR;
          this.smokeInstColor[colIdx + 1] = p.colorG;
          this.smokeInstColor[colIdx + 2] = p.colorB;
          this.smokeInstColor[colIdx + 3] = 1.0;

          this.smokeInstVel[vIdx] = p.velocity.x;
          this.smokeInstVel[vIdx + 1] = p.velocity.y;
          this.smokeInstVel[vIdx + 2] = p.velocity.z;
        } else {
          this.smokeInstPos[pIdx] = 0;
          this.smokeInstPos[pIdx + 1] = -99999;
          this.smokeInstPos[pIdx + 2] = 0;

          this.smokeInstParams[paramIdx] = 0;
          this.smokeInstParams[paramIdx + 1] = 0;
          this.smokeInstParams[paramIdx + 2] = 0.0;
          this.smokeInstParams[paramIdx + 3] = 1.0;

          this.smokeInstColor[colIdx] = 1;
          this.smokeInstColor[colIdx + 1] = 1;
          this.smokeInstColor[colIdx + 2] = 1;
          this.smokeInstColor[colIdx + 3] = 0;

          this.smokeInstVel[vIdx] = 0;
          this.smokeInstVel[vIdx + 1] = 0;
          this.smokeInstVel[vIdx + 2] = 0;
        }
      }

      const posAttr = this.smokeInstGeo.getAttribute('aInstancePos') as THREE.InstancedBufferAttribute;
      const paramsAttr = this.smokeInstGeo.getAttribute('aInstanceParams') as THREE.InstancedBufferAttribute;
      const colAttr = this.smokeInstGeo.getAttribute('aInstanceColor') as THREE.InstancedBufferAttribute;
      const velAttr = this.smokeInstGeo.getAttribute('aInstanceVel') as THREE.InstancedBufferAttribute;

      posAttr.clearUpdateRanges();
      posAttr.addUpdateRange(0, updateLimit * 3);
      posAttr.needsUpdate = true;

      paramsAttr.clearUpdateRanges();
      paramsAttr.addUpdateRange(0, updateLimit * 4);
      paramsAttr.needsUpdate = true;

      colAttr.clearUpdateRanges();
      colAttr.addUpdateRange(0, updateLimit * 4);
      colAttr.needsUpdate = true;

      velAttr.clearUpdateRanges();
      velAttr.addUpdateRange(0, updateLimit * 3);
      velAttr.needsUpdate = true;
    }
    this.prevActiveSmoke = activeSmoke;
  }

  /**
   * Initialize dynamic aerodynamic wingtip condensation vortex ribbon mesh
   */
  private initWingtipVortices(): void {
    const segments = 24; // 24 segments per wingtip
    const totalQuads = segments * 2;
    const totalVerts = totalQuads * 6;

    this.vortexPositions = new Float32Array(totalVerts * 3);
    this.vortexColors = new Float32Array(totalVerts * 4);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.vortexPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.vortexColors, 4));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.vortexRibbonMesh = new THREE.Mesh(geo, mat);
    this.vortexRibbonMesh.frustumCulled = false;
    this.vortexRibbonMesh.visible = false;
    this.group.add(this.vortexRibbonMesh);

    for (let i = 0; i < 24; i++) {
      this.leftVortexHistory.push(new THREE.Vector3(0, -1000, 0));
      this.rightVortexHistory.push(new THREE.Vector3(0, -1000, 0));
    }
  }

  /**
   * Update aerodynamic wingtip condensation vortex ribbons trailing from rear wingtips
   * @param leftTip World position of left rear wingtip
   * @param rightTip World position of right rear wingtip
   * @param _rearDir Normalized rearward heading direction
   * @param speedKmh Vehicle speed in km/h
   */
  public updateWingtipVortices(
    leftTip: THREE.Vector3,
    rightTip: THREE.Vector3,
    _rearDir: THREE.Vector3,
    speedKmh: number,
    dt: number = 0.016
  ): void {
    if (speedKmh <= 115) {
      if (this.vortexRibbonMesh.visible) {
        this.vortexRibbonMesh.visible = false;
      }
      return;
    }

    this.vortexRibbonMesh.visible = true;
    this.vortexTime += dt;
    const intensity = Math.min(1.0, (speedKmh - 115) / 135);

    // Shift ring history
    for (let i = this.leftVortexHistory.length - 1; i > 0; i--) {
      this.leftVortexHistory[i].copy(this.leftVortexHistory[i - 1]);
      this.rightVortexHistory[i].copy(this.rightVortexHistory[i - 1]);
    }

    this.leftVortexHistory[0].copy(leftTip);
    this.rightVortexHistory[0].copy(rightTip);

    const halfRibbonW = 0.024; // 24mm razor-sharp aerodynamic filament
    let vertOffset = 0;

    const buildSideRibbon = (history: THREE.Vector3[], isRight: boolean) => {
      const segCount = history.length - 1;
      for (let s = 0; s < segCount; s++) {
        const p1 = history[s];
        const p2 = history[s + 1];

        if (p1.y < -500 || p2.y < -500) {
          for (let k = 0; k < 6; k++) {
            const vIdx = (vertOffset + k) * 3;
            const cIdx = (vertOffset + k) * 4;
            this.vortexPositions[vIdx] = 0;
            this.vortexPositions[vIdx + 1] = -1000;
            this.vortexPositions[vIdx + 2] = 0;
            this.vortexColors[cIdx + 3] = 0;
          }
          vertOffset += 6;
          continue;
        }

        const t = s / segCount;
        const fade = Math.pow(1.0 - t, 1.8) * intensity * 0.55;

        // Slight vortex spiral swirl
        const swirlAngle = this.vortexTime * 15.0 + s * 0.45 * (isRight ? 1 : -1);
        const swirlY = Math.sin(swirlAngle) * 0.015;
        const swirlX = Math.cos(swirlAngle) * 0.015;

        const p1L_x = p1.x - halfRibbonW + swirlX, p1L_y = p1.y + swirlY, p1L_z = p1.z;
        const p1R_x = p1.x + halfRibbonW + swirlX, p1R_y = p1.y + swirlY, p1R_z = p1.z;
        const p2L_x = p2.x - halfRibbonW, p2L_y = p2.y, p2L_z = p2.z;
        const p2R_x = p2.x + halfRibbonW, p2R_y = p2.y, p2R_z = p2.z;

        // Direct zero-allocation writes for the 6 quad vertices
        const v0 = vertOffset * 3;
        this.vortexPositions[v0] = p1L_x; this.vortexPositions[v0 + 1] = p1L_y; this.vortexPositions[v0 + 2] = p1L_z;
        const v1 = (vertOffset + 1) * 3;
        this.vortexPositions[v1] = p1R_x; this.vortexPositions[v1 + 1] = p1R_y; this.vortexPositions[v1 + 2] = p1R_z;
        const v2 = (vertOffset + 2) * 3;
        this.vortexPositions[v2] = p2R_x; this.vortexPositions[v2 + 1] = p2R_y; this.vortexPositions[v2 + 2] = p2R_z;
        const v3 = (vertOffset + 3) * 3;
        this.vortexPositions[v3] = p1L_x; this.vortexPositions[v3 + 1] = p1L_y; this.vortexPositions[v3 + 2] = p1L_z;
        const v4 = (vertOffset + 4) * 3;
        this.vortexPositions[v4] = p2R_x; this.vortexPositions[v4 + 1] = p2R_y; this.vortexPositions[v4 + 2] = p2R_z;
        const v5 = (vertOffset + 5) * 3;
        this.vortexPositions[v5] = p2L_x; this.vortexPositions[v5 + 1] = p2L_y; this.vortexPositions[v5 + 2] = p2L_z;

        for (let k = 0; k < 6; k++) {
          const cIdx = (vertOffset + k) * 4;
          // Luminous cyan-white aerodynamic condensation core
          this.vortexColors[cIdx] = 0.85;
          this.vortexColors[cIdx + 1] = 0.95;
          this.vortexColors[cIdx + 2] = 1.0;
          this.vortexColors[cIdx + 3] = fade;
        }

        vertOffset += 6;
      }
    };

    buildSideRibbon(this.leftVortexHistory, false);
    buildSideRibbon(this.rightVortexHistory, true);

    this.vortexRibbonMesh.geometry.attributes.position.needsUpdate = true;
    (this.vortexRibbonMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  /**
   * Complete GPU resource cleanup
   */
  public dispose(): void {
    if (this.smokeTexture) this.smokeTexture.dispose();
    if (this.groundGlowTexture) this.groundGlowTexture.dispose();
    if (this.scorchTexture) this.scorchTexture.dispose();

    if (this.sparkMesh) {
      this.sparkMesh.geometry.dispose();
      (this.sparkMesh.material as THREE.Material).dispose();
    }
    if (this.smokeMesh) {
      this.smokeMesh.geometry.dispose();
      if (this.smokeMaterial) this.smokeMaterial.dispose();
    }
    if (this.debrisMesh) {
      this.debrisMesh.geometry.dispose();
      (this.debrisMesh.material as THREE.Material).dispose();
    }
    if (this.groundGlowMesh) {
      this.groundGlowMesh.geometry.dispose();
      this.groundGlowMaterial.dispose();
    }
    if (this.scorchMesh) {
      this.scorchMesh.geometry.dispose();
      (this.scorchMesh.material as THREE.Material).dispose();
    }
    if (this.vortexRibbonMesh) {
      this.vortexRibbonMesh.geometry.dispose();
      (this.vortexRibbonMesh.material as THREE.Material).dispose();
    }
    if (this.skidMesh) {
      this.skidMesh.geometry.dispose();
      (this.skidMesh.material as THREE.Material).dispose();
    }
  }
}
