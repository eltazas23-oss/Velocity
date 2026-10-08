/**
 * GrandstandCrowdSystem.ts - High-Performance 60+ FPS GPU-Driven 3D Crowd Engine
 * 
 * Features:
 * - Anatomically Proportioned 3D Human Spectators (Head, Cap, Torso, Arms, Legs, Flags)
 * - Zero CPU Skinning / Zero GC Churn: 100% GPU Vertex Shader Kinematics
 * - Dynamic Interactive Behaviors: Clapping, Cheering, Flag Waving, and Speed Ovations
 * - Vivid Team Apparel & Diversity Palette (Apex Red, Alpine Blue, Jordan Gold, Aston Green, Mercedes Silver)
 * - Directional PBR Sun & Ambient Hemisphere Lighting Integration
 * - Mathematically Calibrated Spatial Placement for Curved Amphitheaters, Natural Berms, & Paddock
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { safeMergeBufferGeometries } from '../utils/GeometryUtils';

export interface CrowdPlacementConfig {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch?: number;
  isStanding?: boolean;
  hasFlag?: boolean;
  density?: number;
}

export class GrandstandCrowdSystem {
  public group: THREE.Group;
  private crowdMeshes: THREE.InstancedMesh[] = [];
  private flagMeshes: THREE.InstancedMesh[] = [];
  private crowdMaterial!: THREE.ShaderMaterial;
  private flagMaterial!: THREE.ShaderMaterial;

  private uniformTime: { value: number } = { value: 0 };
  private uniformCarPos: { value: THREE.Vector3 } = { value: new THREE.Vector3(0, 0, 0) };
  private uniformCarSpeed: { value: number } = { value: 0 };
  private uniformExcitement: { value: number } = { value: 0.25 };
  private uniformSunDir: { value: THREE.Vector3 } = { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() };

  private static readonly HUMAN_PALETTES = [
    { torso: 0xdc2626, cap: 0x991b1b, flag: 0xef4444 }, // Apex Racing Red
    { torso: 0x2563eb, cap: 0x1e3a8a, flag: 0x3b82f6 }, // Alpine Sapphire
    { torso: 0xf59e0b, cap: 0xb45309, flag: 0xfbbf24 }, // Jordan Gold
    { torso: 0x059669, cap: 0x064e3b, flag: 0x10b981 }, // Aston British Emerald
    { torso: 0x1e293b, cap: 0x475569, flag: 0x64748b }, // Obsidian Charcoal
    { torso: 0xf8fafc, cap: 0xdc2626, flag: 0xffffff }, // White Team Polo / Red Cap
    { torso: 0x7c3aed, cap: 0x5b21b6, flag: 0x8b5cf6 }, // Royal Purple
    { torso: 0x0284c7, cap: 0x0369a1, flag: 0x38bdf8 }, // Sky Turbo Blue
    { torso: 0xe11d48, cap: 0xbe123c, flag: 0xf43f5e }, // Crimson Passion
    { torso: 0xea580c, cap: 0xc2410c, flag: 0xf97316 }, // Papaya Racing Orange
  ];

  private static readonly SKIN_TONES = [
    0xf8d7b8, // Fair
    0xe0ac69, // Warm Olive
    0x8d5524, // Deep Tan
    0xc68642, // Rich Bronze
    0x50331b, // Deep Brown
    0xffdbac, // Light Peach
  ];

  private blenderSpectatorGeo: THREE.BufferGeometry | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'GrandstandCrowdSystem';
    this.initMaterials();
    this.loadBlenderSpectatorModel();
  }

  /**
   * Asynchronously loads the Blender-sculpted photorealistic 3D human spectator asset.
   * Seamlessly hot-swaps all GPU instanced meshes with the anatomical high-definition model.
   */
  private loadBlenderSpectatorModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      '/models/photorealistic_spectator.glb',
      (gltf) => {
        const partsGeos: THREE.BufferGeometry[] = [];
        const tagBodyPart = (geo: THREE.BufferGeometry, partCode: number): THREE.BufferGeometry => {
          const nonIndexed = geo.toNonIndexed();
          const count = nonIndexed.attributes.position.count;
          const partAttr = new Float32Array(count);
          partAttr.fill(partCode);
          nonIndexed.setAttribute('aBodyPart', new THREE.BufferAttribute(partAttr, 1));
          return nonIndexed;
        };

        const partCodes: Record<string, number> = {
          Legs: 0.0,
          Torso: 1.0,
          Head: 2.0,
          Cap: 3.0,
          ArmL: 4.0,
          ArmR: 5.0,
        };

        gltf.scene.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            const mesh = c as THREE.Mesh;
            for (const [key, code] of Object.entries(partCodes)) {
              if (mesh.name.includes(key)) {
                partsGeos.push(tagBodyPart(mesh.geometry.clone(), code));
                break;
              }
            }
          }
        });

        if (partsGeos.length > 0) {
          const merged = safeMergeBufferGeometries(partsGeos, false);
          if (merged) {
            merged.computeVertexNormals();
            this.blenderSpectatorGeo = merged;
            // Upgrade all existing GPU instanced crowd meshes
            for (const cm of this.crowdMeshes) {
              const oldGeo = cm.geometry;
              const newGeo = merged.clone();
              const instancedAttrNames = [
                'aPhase',
                'aAnimType',
                'aSpeed',
                'aTorsoColor',
                'aCapColor',
                'aSkinColor',
                'aCheerSens',
              ];
              for (const attrName of instancedAttrNames) {
                const attr = oldGeo.getAttribute(attrName);
                if (attr) {
                  newGeo.setAttribute(attrName, attr);
                }
              }
              cm.geometry = newGeo;
              oldGeo.dispose();
            }
          }
        }
      },
      undefined,
      () => {
        // Fallback procedural geometry remains active
      }
    );
  }

  private initMaterials(): void {
    this.crowdMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.uniformTime,
        uCarPos: this.uniformCarPos,
        uCarSpeed: this.uniformCarSpeed,
        uExcitement: this.uniformExcitement,
        uSunDir: this.uniformSunDir,
      },
      vertexShader: /* glsl */ `
        precision highp float;

        attribute float aPhase;
        attribute float aAnimType;     // 0=clap, 1=two-arm cheer, 2=wave jump, 3=head sway, 4=fist pump
        attribute float aSpeed;
        attribute vec3 aTorsoColor;
        attribute vec3 aCapColor;
        attribute vec3 aSkinColor;
        attribute float aBodyPart;      // 0=legs/pants, 1=torso, 2=skin/face, 3=cap, 4=left arm, 5=right arm
        attribute float aCheerSens;

        uniform float uTime;
        uniform vec3 uCarPos;
        uniform float uCarSpeed;
        uniform float uExcitement;
        uniform vec3 uSunDir;

        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vColor;
        varying float vDiffuse;
        varying float vBodyPart;

        void main() {
          vec3 transformed = position;
          vec3 transformedNormal = normal;
          vBodyPart = aBodyPart;

          // Compute world position of instance
          vec4 worldInstancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float distToCar = distance(worldInstancePos.xyz, uCarPos);
          
          // Proximity excitement wave (cheer surges when car passes by within 40m)
          float proximityBoost = smoothstep(42.0, 12.0, distToCar) * smoothstep(15.0, 90.0, uCarSpeed);
          float totalExcitement = clamp(uExcitement + proximityBoost * 1.8, 0.0, 2.5);

          float t = uTime * (aSpeed * (1.0 + totalExcitement * 0.7)) + aPhase;
          int bodyPart = int(aBodyPart + 0.1);

          // Kinematic Deformations based on discrete body part ID
          if (bodyPart == 4 || bodyPart == 5) {
            // ARMS & HANDS KINEMATICS
            float isLeft = (bodyPart == 4) ? -1.0 : 1.0;

            if (aAnimType < 0.5) {
              // Anim 0: Rhythmic Clapping in Front
              float clapPhase = sin(t * 6.5);
              transformed.x += clapPhase * 0.05 * isLeft;
              transformed.y += sin(t * 3.2) * 0.03;
              transformed.z += 0.03 + cos(t * 6.5) * 0.025;
            } else if (aAnimType < 1.5) {
              // Anim 1: Double-Arm Celebration (Arms high up in the air)
              float raiseArm = 0.22 + sin(t * 4.2) * 0.09 * totalExcitement;
              transformed.y += raiseArm;
              transformed.x += sin(t * 2.8 + aPhase) * 0.04 * isLeft;
            } else if (aAnimType < 2.5) {
              // Anim 2: Mexican Wave Arm Sweep
              float waveTime = sin(uTime * 2.5 - worldInstancePos.x * 0.08 + worldInstancePos.z * 0.05);
              float wavePeak = smoothstep(0.4, 0.95, waveTime);
              transformed.y += wavePeak * 0.32;
              transformed.x += wavePeak * 0.08 * isLeft;
            } else if (aAnimType < 3.5) {
              // Anim 3: Cheering with one arm
              if (isLeft > 0.0) {
                transformed.y += 0.18 + sin(t * 4.5) * 0.07;
              } else {
                transformed.y += sin(t * 2.0) * 0.02;
              }
            } else {
              // Anim 4: Fist Pump
              if (isLeft < 0.0) {
                transformed.y += 0.20 + sin(t * 5.5) * 0.08;
                transformed.z += 0.04 + cos(t * 5.5) * 0.04;
              }
            }
          } else if (bodyPart == 2 || bodyPart == 3) {
            // HEAD & CAP: Subtle cheering nod & look
            float headBob = sin(t * 3.2) * 0.015 * totalExcitement;
            float headTurn = sin(t * 1.1 + aPhase) * 0.04;
            transformed.y += headBob;
            transformed.x += headTurn;
          } else if (bodyPart == 1) {
            // TORSO: Subtle rhythmic chest sway
            float torsoSway = sin(t * 2.2) * 0.012 * totalExcitement;
            transformed.y += torsoSway;
            transformed.x += sin(t * 1.2 + aPhase) * 0.01;
          }

          // Global Instance Body Jump when doing Wave
          if (aAnimType > 1.5 && aAnimType < 2.5) {
            float waveTime = sin(uTime * 2.5 - worldInstancePos.x * 0.08 + worldInstancePos.z * 0.05);
            float jumpHeight = smoothstep(0.5, 0.98, waveTime) * 0.28;
            transformed.y += jumpHeight;
          }

          vec4 worldPos = instanceMatrix * vec4(transformed, 1.0);
          vWorldPos = worldPos.xyz;

          mat3 normalMat = mat3(instanceMatrix);
          vNormal = normalize(normalMat * transformedNormal);

          // Sunlight Diffuse & Ambient Calculation
          float nDotL = max(dot(vNormal, uSunDir), 0.0);
          vDiffuse = 0.45 + nDotL * 0.65;

          // Color Assignment based on discrete Body Part
          if (bodyPart == 0) {
            // Pants / Legs: Dark Charcoal / Indigo Navy
            vColor = vec3(0.14, 0.16, 0.24);
          } else if (bodyPart == 1) {
            // Torso: Team Polo / Shirt
            vColor = aTorsoColor;
          } else if (bodyPart == 2) {
            // Face / Skin Tone
            vColor = aSkinColor;
          } else if (bodyPart == 3) {
            // Cap / Hat
            vColor = aCapColor;
          } else {
            // Arms / Hands: Skin Tone
            vColor = aSkinColor;
          }

          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;

        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vColor;
        varying float vDiffuse;
        varying float vBodyPart;

        void main() {
          vec3 finalColor = vColor * vDiffuse;
          vec3 viewDir = normalize(cameraPosition - vWorldPos);

          // PBR enhancements per anatomical body part
          if (abs(vBodyPart - 2.0) < 0.2 || vBodyPart >= 3.8) {
            // Warm human skin subsurface scattering approximation
            finalColor += vec3(0.045, 0.018, 0.010) * vDiffuse;
          } else if (abs(vBodyPart - 3.0) < 0.2) {
            // Polarized sport sunglasses & cap visor specular sheen
            vec3 halfVec = normalize(viewDir + vec3(0.5, 0.8, 0.3));
            float spec = pow(max(dot(vNormal, halfVec), 0.0), 24.0);
            finalColor += vec3(0.40, 0.45, 0.55) * spec * 0.45;
          } else if (abs(vBodyPart) < 0.2) {
            // Textured dark indigo denim pants
            finalColor = mix(finalColor, vec3(0.12, 0.14, 0.22) * vDiffuse, 0.65);
          }
          
          // Subtle stadium rim-light for depth definition
          float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
          rim = smoothstep(0.68, 0.98, rim) * 0.20;
          finalColor += vec3(0.95, 0.98, 1.0) * rim;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    this.flagMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: this.uniformTime,
        uCarPos: this.uniformCarPos,
        uCarSpeed: this.uniformCarSpeed,
        uExcitement: this.uniformExcitement,
        uSunDir: this.uniformSunDir,
      },
      vertexShader: /* glsl */ `
        precision highp float;

        attribute float aPhase;
        attribute float aSpeed;
        attribute vec3 aFlagColor;

        uniform float uTime;
        uniform vec3 uSunDir;
        uniform float uExcitement;

        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vColor;
        varying float vDiffuse;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec3 transformed = position;

          // Wind fluttering wave along flag width (uv.x > 0)
          float waveSpeed = uTime * (5.5 + aSpeed * 3.5) + aPhase;
          float flutter = sin(waveSpeed + transformed.x * 7.0) * cos(waveSpeed * 0.6 + transformed.y * 4.5);
          float flutterAmp = uv.x * (0.07 + uExcitement * 0.04);

          transformed.z += flutter * flutterAmp;
          transformed.y += sin(waveSpeed * 0.8 + transformed.x * 5.0) * flutterAmp * 0.35;

          vec4 worldPos = instanceMatrix * vec4(transformed, 1.0);
          vWorldPos = worldPos.xyz;

          mat3 normalMat = mat3(instanceMatrix);
          vNormal = normalize(normalMat * normal);

          float nDotL = abs(dot(vNormal, uSunDir));
          vDiffuse = 0.45 + nDotL * 0.60;
          vColor = aFlagColor;

          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;

        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vColor;
        varying float vDiffuse;
        varying vec2 vUv;

        void main() {
          vec3 flagPattern = vColor;
          
          // Racing check border stripe on flags
          if (vUv.x > 0.85 || vUv.y > 0.90 || vUv.y < 0.10) {
            float check = step(0.5, fract(vUv.x * 10.0)) * step(0.5, fract(vUv.y * 10.0));
            flagPattern = mix(flagPattern, vec3(1.0) * check, 0.60);
          }

          vec3 finalColor = flagPattern * vDiffuse;
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }

  /**
   * Builds an anatomically proportional 3D Human Spectator Base Geometry
   * Total seated height: ~1.12m. Standing height: ~1.72m.
   */
  private buildSpectatorBaseGeometry(): THREE.BufferGeometry {
    if (this.blenderSpectatorGeo) {
      return this.blenderSpectatorGeo.clone();
    }

    const partsGeos: THREE.BufferGeometry[] = [];

    const tagBodyPart = (geo: THREE.BufferGeometry, partCode: number): THREE.BufferGeometry => {
      const nonIndexed = geo.toNonIndexed();
      const count = nonIndexed.attributes.position.count;
      const partAttr = new Float32Array(count);
      partAttr.fill(partCode);
      nonIndexed.setAttribute('aBodyPart', new THREE.BufferAttribute(partAttr, 1));
      return nonIndexed;
    };

    // 1. Lower Body / Legs (Anatomically proportioned seated legs)
    // Left & Right Thighs (Part 0)
    [-0.11, 0.11].forEach((lx) => {
      const thigh = new THREE.CylinderGeometry(0.082, 0.074, 0.36, 7);
      thigh.rotateX(Math.PI / 2);
      thigh.translate(lx, 0.42, 0.18);
      partsGeos.push(tagBodyPart(thigh, 0.0));

      const calf = new THREE.CylinderGeometry(0.072, 0.060, 0.34, 7);
      calf.translate(lx, 0.20, 0.36);
      partsGeos.push(tagBodyPart(calf, 0.0));

      // Sneaker with rubber sole
      const shoe = new THREE.BoxGeometry(0.086, 0.07, 0.19);
      shoe.translate(lx, 0.05, 0.43);
      partsGeos.push(tagBodyPart(shoe, 0.0));
    });

    // 2. Torso (Part 1 - Team polo shirt with athletic chest taper)
    const torsoGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.44, 8);
    torsoGeo.translate(0, 0.67, 0.0);
    partsGeos.push(tagBodyPart(torsoGeo, 1.0));

    // Polo collar & shoulder caps
    const collarGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.08, 8);
    collarGeo.translate(0, 0.88, 0.02);
    partsGeos.push(tagBodyPart(collarGeo, 1.0));

    // 3. Head & Face (Part 2 - Anatomical head with neck and facial features)
    const neckGeo = new THREE.CylinderGeometry(0.062, 0.068, 0.10, 7);
    neckGeo.translate(0, 0.90, 0.0);
    partsGeos.push(tagBodyPart(neckGeo, 2.0));

    const headGeo = new THREE.SphereGeometry(0.115, 8, 7);
    headGeo.scale(1.0, 1.25, 1.1);
    headGeo.translate(0, 1.01, 0.01);
    partsGeos.push(tagBodyPart(headGeo, 2.0));

    // Nose & brow ridge
    const noseGeo = new THREE.ConeGeometry(0.025, 0.05, 4);
    noseGeo.rotateX(Math.PI / 2);
    noseGeo.translate(0, 1.01, 0.13);
    partsGeos.push(tagBodyPart(noseGeo, 2.0));

    // 4. Baseball Cap & Sunglasses (Part 3)
    const capCrown = new THREE.SphereGeometry(0.122, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    capCrown.translate(0, 1.03, 0.0);
    partsGeos.push(tagBodyPart(capCrown, 3.0));

    const capVisor = new THREE.BoxGeometry(0.14, 0.022, 0.10);
    capVisor.rotateX(-0.16);
    capVisor.translate(0, 1.03, 0.14);
    partsGeos.push(tagBodyPart(capVisor, 3.0));

    const sunglasses = new THREE.BoxGeometry(0.13, 0.032, 0.035);
    sunglasses.translate(0, 1.025, 0.12);
    partsGeos.push(tagBodyPart(sunglasses, 3.0));

    // 5. Left Arm (Part 4)
    const leftArmUpper = new THREE.CylinderGeometry(0.046, 0.040, 0.22, 6);
    leftArmUpper.rotateZ(0.32);
    leftArmUpper.translate(-0.19, 0.72, 0.04);
    partsGeos.push(tagBodyPart(leftArmUpper, 4.0));

    const leftForearm = new THREE.CylinderGeometry(0.040, 0.034, 0.20, 6);
    leftForearm.rotateX(-0.75);
    leftForearm.translate(-0.21, 0.62, 0.14);
    partsGeos.push(tagBodyPart(leftForearm, 4.0));

    const leftHand = new THREE.BoxGeometry(0.045, 0.028, 0.07);
    leftHand.translate(-0.21, 0.58, 0.24);
    partsGeos.push(tagBodyPart(leftHand, 4.0));

    // 6. Right Arm (Part 5)
    const rightArmUpper = new THREE.CylinderGeometry(0.046, 0.040, 0.22, 6);
    rightArmUpper.rotateZ(-0.32);
    rightArmUpper.translate(0.19, 0.72, 0.04);
    partsGeos.push(tagBodyPart(rightArmUpper, 5.0));

    const rightForearm = new THREE.CylinderGeometry(0.040, 0.034, 0.20, 6);
    rightForearm.rotateX(-0.75);
    rightForearm.translate(0.21, 0.62, 0.14);
    partsGeos.push(tagBodyPart(rightForearm, 5.0));

    const rightHand = new THREE.BoxGeometry(0.045, 0.028, 0.07);
    rightHand.translate(0.21, 0.58, 0.24);
    partsGeos.push(tagBodyPart(rightHand, 5.0));

    const merged = safeMergeBufferGeometries(partsGeos, false) || new THREE.BufferGeometry();
    merged.computeVertexNormals();
    return merged;
  }

  /**
   * Builds the 3D Waving Team Flag Base Geometry
   */
  private buildFlagBaseGeometry(): THREE.BufferGeometry {
    const flagParts: THREE.BufferGeometry[] = [];

    // Flag Pole (Lightweight carbon rod)
    const poleGeo = new THREE.CylinderGeometry(0.014, 0.014, 1.35, 6);
    poleGeo.translate(0, 0.68, 0);
    poleGeo.rotateZ(-0.25);
    poleGeo.rotateX(-0.32);
    flagParts.push(poleGeo.toNonIndexed());

    // Flag Fabric
    const clothGeo = new THREE.PlaneGeometry(0.70, 0.45, 8, 4);
    clothGeo.translate(0.35, 1.10, 0);
    clothGeo.rotateZ(-0.25);
    clothGeo.rotateX(-0.32);
    flagParts.push(clothGeo.toNonIndexed());

    const merged = safeMergeBufferGeometries(flagParts, false) || new THREE.BufferGeometry();
    merged.computeVertexNormals();
    return merged;
  }

  /**
   * Instantiates high-density 3D Crowd for Grandstands partitioned into localized spatial chunks
   * (Enables 100% native Three.js Frustum Culling when driving on different sectors of the circuit)
   */
  public generateCrowd(placements: CrowdPlacementConfig[]): void {
    if (placements.length === 0) return;

    // Partition placements into 4 spatial zones:
    // 0: South West (z < 0, x < -20)
    // 1: South Center (z < 0, -20 <= x <= 20)
    // 2: South East (z < 0, x > 20)
    // 3: North viewing berm (z >= 0)
    const chunks: CrowdPlacementConfig[][] = [[], [], [], []];
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      if (p.z >= 0) {
        chunks[3].push(p);
      } else if (p.x < -20) {
        chunks[0].push(p);
      } else if (p.x > 20) {
        chunks[2].push(p);
      } else {
        chunks[1].push(p);
      }
    }

    const dummy = new THREE.Object3D();
    const colorObj = new THREE.Color();

    for (let c = 0; c < chunks.length; c++) {
      const chunkPlacements = chunks[c];
      const instanceCount = chunkPlacements.length;
      if (instanceCount === 0) continue;

      const spectatorGeo = this.buildSpectatorBaseGeometry();
      const crowdMesh = new THREE.InstancedMesh(spectatorGeo, this.crowdMaterial, instanceCount);
      crowdMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

      const phaseArray = new Float32Array(instanceCount);
      const animTypeArray = new Float32Array(instanceCount);
      const speedArray = new Float32Array(instanceCount);
      const torsoColorArray = new Float32Array(instanceCount * 3);
      const capColorArray = new Float32Array(instanceCount * 3);
      const skinColorArray = new Float32Array(instanceCount * 3);
      const cheerSensArray = new Float32Array(instanceCount);

      const flagPlacements: Array<{ matrix: THREE.Matrix4; color: THREE.Color; phase: number; speed: number }> = [];

      for (let i = 0; i < instanceCount; i++) {
        const p = chunkPlacements[i];

        const yawJitter = (Math.random() - 0.5) * 0.18;
        const pitchJitter = (Math.random() - 0.5) * 0.08;

        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(pitchJitter + (p.pitch || 0), p.yaw + yawJitter, 0);

        const heightScale = 0.94 + Math.random() * 0.12;
        dummy.scale.set(0.96 + Math.random() * 0.08, heightScale, 0.96 + Math.random() * 0.08);
        dummy.updateMatrix();

        crowdMesh.setMatrixAt(i, dummy.matrix);

        phaseArray[i] = Math.random() * Math.PI * 2;
        speedArray[i] = 0.88 + Math.random() * 0.30;
        cheerSensArray[i] = 28.0 + Math.random() * 18.0;

        const randAnim = Math.random();
        if (randAnim < 0.38) animTypeArray[i] = 0.0;
        else if (randAnim < 0.62) animTypeArray[i] = 1.0;
        else if (randAnim < 0.82) animTypeArray[i] = 2.0;
        else if (randAnim < 0.93) animTypeArray[i] = 3.0;
        else animTypeArray[i] = 4.0;

        const palIdx = Math.floor(Math.random() * GrandstandCrowdSystem.HUMAN_PALETTES.length);
        const palette = GrandstandCrowdSystem.HUMAN_PALETTES[palIdx];

        colorObj.setHex(palette.torso);
        colorObj.offsetHSL((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06);
        torsoColorArray[i * 3 + 0] = colorObj.r;
        torsoColorArray[i * 3 + 1] = colorObj.g;
        torsoColorArray[i * 3 + 2] = colorObj.b;

        colorObj.setHex(palette.cap);
        capColorArray[i * 3 + 0] = colorObj.r;
        capColorArray[i * 3 + 1] = colorObj.g;
        capColorArray[i * 3 + 2] = colorObj.b;

        const skinIdx = Math.floor(Math.random() * GrandstandCrowdSystem.SKIN_TONES.length);
        colorObj.setHex(GrandstandCrowdSystem.SKIN_TONES[skinIdx]);
        skinColorArray[i * 3 + 0] = colorObj.r;
        skinColorArray[i * 3 + 1] = colorObj.g;
        skinColorArray[i * 3 + 2] = colorObj.b;

        if (p.hasFlag || (Math.random() < 0.07 && !p.isStanding)) {
          const flagDummy = new THREE.Object3D();
          flagDummy.position.set(p.x, p.y + 0.45, p.z);
          flagDummy.rotation.set(0, p.yaw + (Math.random() - 0.5) * 0.4, 0);
          flagDummy.updateMatrix();

          const flagCol = new THREE.Color(palette.flag);
          flagPlacements.push({
            matrix: flagDummy.matrix.clone(),
            color: flagCol,
            phase: phaseArray[i],
            speed: speedArray[i],
          });
        }
      }

      spectatorGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phaseArray, 1));
      spectatorGeo.setAttribute('aAnimType', new THREE.InstancedBufferAttribute(animTypeArray, 1));
      spectatorGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speedArray, 1));
      spectatorGeo.setAttribute('aTorsoColor', new THREE.InstancedBufferAttribute(torsoColorArray, 3));
      spectatorGeo.setAttribute('aCapColor', new THREE.InstancedBufferAttribute(capColorArray, 3));
      spectatorGeo.setAttribute('aSkinColor', new THREE.InstancedBufferAttribute(skinColorArray, 3));
      spectatorGeo.setAttribute('aCheerSens', new THREE.InstancedBufferAttribute(cheerSensArray, 1));

      crowdMesh.instanceMatrix.needsUpdate = true;
      crowdMesh.computeBoundingSphere();
      crowdMesh.computeBoundingBox();
      crowdMesh.castShadow = false;
      crowdMesh.receiveShadow = false;
      this.crowdMeshes.push(crowdMesh);
      this.group.add(crowdMesh);

      if (flagPlacements.length > 0) {
        const flagGeo = this.buildFlagBaseGeometry();
        const flagMesh = new THREE.InstancedMesh(flagGeo, this.flagMaterial, flagPlacements.length);
        const fPhaseArray = new Float32Array(flagPlacements.length);
        const fSpeedArray = new Float32Array(flagPlacements.length);
        const fColorArray = new Float32Array(flagPlacements.length * 3);

        flagPlacements.forEach((fp, fIdx) => {
          flagMesh.setMatrixAt(fIdx, fp.matrix);
          fPhaseArray[fIdx] = fp.phase;
          fSpeedArray[fIdx] = fp.speed;
          fColorArray[fIdx * 3 + 0] = fp.color.r;
          fColorArray[fIdx * 3 + 1] = fp.color.g;
          fColorArray[fIdx * 3 + 2] = fp.color.b;
        });

        flagGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(fPhaseArray, 1));
        flagGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(fSpeedArray, 1));
        flagGeo.setAttribute('aFlagColor', new THREE.InstancedBufferAttribute(fColorArray, 3));

        flagMesh.instanceMatrix.needsUpdate = true;
        flagMesh.computeBoundingSphere();
        flagMesh.computeBoundingBox();
        flagMesh.castShadow = false;
        flagMesh.receiveShadow = false;
        this.flagMeshes.push(flagMesh);
        this.group.add(flagMesh);
      }
    }
  }

  /**
   * Generates crowd placements for the South Main Curved Grandstand (Curving towards Z = -130)
   */
  public static generateSouthAmphitheaterCrowd(
    width: number,
    tiers: number,
    tierRise: number,
    baseZ: number,
    density = 0.88
  ): CrowdPlacementConfig[] {
    const list: CrowdPlacementConfig[] = [];
    const halfW = width / 2;
    const seatPitch = 0.95;

    for (let t = 0; t < tiers; t++) {
      const tierWidth = width - t * 2.2;
      const tierHalfW = tierWidth / 2;
      const baseY = 2.0 + t * tierRise;
      const centerZ = baseZ - t * 2.0;
      const seatCount = Math.floor((tierWidth - 2.8) / seatPitch);

      for (let s = 0; s <= seatCount; s++) {
        const sx = -tierHalfW + 1.4 + s * seatPitch;

        // Skip aisle stairways
        if (
          Math.abs(sx) < 1.2 ||
          Math.abs(sx - 28) < 1.2 ||
          Math.abs(sx + 28) < 1.2 ||
          Math.abs(sx - 52) < 1.2 ||
          Math.abs(sx + 52) < 1.2
        ) {
          continue;
        }

        if (Math.random() > density) continue;

        // Parabolic forward curve towards track (-130)
        const curveOffset = Math.pow(sx / halfW, 2) * 3.5;
        const sz = centerZ + 0.25 + curveOffset;

        // Facing track northwards
        const dx = 0.05;
        const dz = (Math.pow((sx + dx) / halfW, 2) - Math.pow(sx / halfW, 2)) * 3.5;
        const yawAngle = -Math.atan2(dz, dx);

        list.push({
          x: sx,
          y: baseY + 0.06,
          z: sz,
          yaw: yawAngle,
          isStanding: false,
        });
      }
    }
    return list;
  }

  /**
   * Generates crowd placements for the North Bank Natural Viewing Berm (Curving towards Z = +130)
   */
  public static generateNorthBankCrowd(
    width: number = 88,
    tiers: number = 6,
    tierRise: number = 0.98,
    baseZ: number = 152.0,
    density = 0.88
  ): CrowdPlacementConfig[] {
    const list: CrowdPlacementConfig[] = [];
    const halfW = width / 2;
    const seatPitch = 0.84;

    for (let t = 0; t < tiers; t++) {
      const tierWidth = width - t * 2.0;
      const tierHalfW = tierWidth / 2;
      const baseY = 1.80 + t * tierRise;
      // Tiers step back away from track into positive Z
      const centerZ = baseZ + t * 2.15 + 0.65;
      const seatCount = Math.floor((tierWidth - 2.4) / seatPitch);

      for (let s = 0; s <= seatCount; s++) {
        const sx = -tierHalfW + 1.2 + s * seatPitch;

        // Skip staircase access corridors (Aisles at center 0m, +/-24m)
        if (Math.abs(sx) < 1.15 || Math.abs(sx - 24) < 1.15 || Math.abs(sx + 24) < 1.15) {
          continue;
        }

        if (Math.random() > density) continue;

        // Parabolic curve matching Blender grandstand model
        const curveOffset = Math.pow(sx / halfW, 2) * 3.2;
        const sz = centerZ + curveOffset - 0.08;

        // Facing track southwards (yaw ≈ Math.PI)
        const dx = 0.05;
        const dz = (Math.pow((sx + dx) / halfW, 2) - Math.pow(sx / halfW, 2)) * 3.2;
        const yawAngle = Math.PI + Math.atan2(dz, dx);

        list.push({
          x: sx,
          y: baseY + 0.38,
          z: sz,
          yaw: yawAngle,
          isStanding: false,
          hasFlag: Math.random() < 0.14,
        });
      }
    }
    return list;
  }

  /**
   * Helper to generate crowd placements along linear grandstands (Speedway / straight stands)
   */
  public static generateLinearGrandstandCrowd(
    centerX: number,
    centerZ: number,
    length: number,
    angle: number,
    rows: number = 6,
    rowRise: number = 0.85,
    rowDepth: number = 1.4,
    baseY: number = 1.2,
    density = 0.85
  ): CrowdPlacementConfig[] {
    const list: CrowdPlacementConfig[] = [];
    const seatPitch = 0.80;
    const seatsPerRow = Math.floor((length - 4.0) / seatPitch);
    const halfLen = length / 2;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let r = 0; r < rows; r++) {
      const y = baseY + r * rowRise;
      // Steps up and back away from track
      const localZ = -(r - rows / 2) * rowDepth;

      for (let s = 0; s < seatsPerRow; s++) {
        const localX = -halfLen + 2.0 + s * seatPitch;

        if (Math.abs(localX % 18.0) < 1.2) continue;
        if (Math.random() > density) continue;

        const wx = centerX + localX * cosA - localZ * sinA;
        const wz = centerZ + localX * sinA + localZ * cosA;

        list.push({
          x: wx,
          y: y + 0.06,
          z: wz,
          yaw: angle,
          isStanding: false,
        });
      }
    }
    return list;
  }

  /**
   * Zero-Allocation Frame Update
   */
  public update(deltaTime: number, carPos: { x: number; y: number; z: number }, carSpeedKmh: number): void {
    this.uniformTime.value += deltaTime;
    this.uniformCarPos.value.set(carPos.x, carPos.y, carPos.z);
    this.uniformCarSpeed.value = carSpeedKmh;

    const targetExcitement = Math.min(2.5, 0.25 + (carSpeedKmh / 280.0) * 0.75);
    this.uniformExcitement.value += (targetExcitement - this.uniformExcitement.value) * Math.min(1.0, deltaTime * 3.0);
  }

  public dispose(): void {
    this.crowdMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      this.group.remove(mesh);
    });
    this.flagMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      this.group.remove(mesh);
    });
    this.crowdMeshes = [];
    this.flagMeshes = [];
    this.crowdMaterial.dispose();
    this.flagMaterial.dispose();
  }
}
