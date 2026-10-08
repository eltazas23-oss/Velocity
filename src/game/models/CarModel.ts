/**
 * CarModel.ts - State-Of-The-Art Contemporary Competition Single-Seater (F1 Hybrid Hyper-Proto)
 * 
 * Masterpiece 3D Procedural Architecture:
 * - 100% custom continuous lofted aerodynamic monocoque fuselage (no primitive block/cylinder stacking).
 * - Sculpted organic sidepods with overbite intakes, deep carbon floor undercuts, and Coke-bottle waistline.
 * - 3-Point continuous titanium tubular Halo with aerodynamic vortex fairing.
 * - True 3D cambered multi-element front wing with spoon dip, outwash footplates, and dual canards.
 * - Swept 3D high-downforce dual-element rear wing with DRS actuator and swan-neck pylons.
 * - Carbon ground-effect floor with vortex strakes and deep multi-channel upswept rear venturi diffuser.
 * - Streamlined carbon double-wishbone suspension, pushrods, driveshafts, and steering tie-rods.
 * - High-detail motorsport wheels: rounded-shoulder competition slicks, concave 10 Y-spoke forged rims,
 *   drilled carbon-ceramic brake discs with thermal glow, and 6-piston Brembo-style calipers.
 * - Deep multi-layer automotive clearcoat metallic paint with procedural 2K high-definition racing livery.
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { safeMergeBufferGeometries, safeMergeAndDispose } from '../utils/GeometryUtils';
import { DamageState } from '../physics/VehiclePhysics';
import { CarModelImporter } from '../loaders/CarModelImporter';
import { TireCompoundType, TIRE_COMPOUNDS } from '../physics/TireCompound';
import { TeamLiveryConfig, RACE_TEAMS } from '../career/CareerTypes';

export class CarModel {
  public group: THREE.Group;
  public liveryConfig: TeamLiveryConfig;
  public isAi: boolean = false;

  // Custom User-Uploaded 3D Model State
  public currentModelName: string = 'Apex F1 Turbo GP';
  public isCustomModel: boolean = false;
  private customModelGroup: THREE.Group = new THREE.Group();
  private proceduralBodyGroup: THREE.Group = new THREE.Group();
  private customWheelMeshes: THREE.Object3D[] = [];
  private customWheelPivotsFront: THREE.Object3D[] = [];

  // Wheel meshes for steering and rotation
  private wheelMeshes: THREE.Group[] = [];
  private wheelPivots: THREE.Group[] = [];
  private wheelPivotsFront: THREE.Group[] = [];
  private brakeDiscs: THREE.Mesh[] = [];
  private tireStripeMaterials: THREE.MeshStandardMaterial[] = [];
  private tireMeshList: THREE.Mesh[] = [];
  private spokeMeshes: THREE.Mesh[] = [];
  private spokeMaterials: THREE.MeshStandardMaterial[] = [];
  private wheelBlurMeshes: THREE.Mesh[] = [];
  private wheelBlurMaterials: THREE.MeshStandardMaterial[] = [];
  private currentTireCompoundColor: string = '#ef4444';
  private currentBlurOpacity: number = 0;
  private currentTireTemp: number[] = [0, 0, 0, 0];

  // Aerodynamic Wing and Deformable Mesh Elements
  private wingGroup!: THREE.Group;
  private frontWingGroup!: THREE.Group;
  private frontWingLeftGroup!: THREE.Group;
  private frontWingRightGroup!: THREE.Group;
  private frontWingLeftMainGroup!: THREE.Group;
  private frontWingLeftUpperFlapGroup!: THREE.Group;
  private frontWingLeftStubMesh!: THREE.Mesh;
  private frontWingRightMainGroup!: THREE.Group;
  private frontWingRightUpperFlapGroup!: THREE.Group;
  private frontWingRightStubMesh!: THREE.Mesh;
  private endplateLeftGroup!: THREE.Group;
  private endplateRightGroup!: THREE.Group;
  private rwEndplateLeft!: THREE.Object3D;
  private rwEndplateRight!: THREE.Object3D;
  private rwPylonLeft!: THREE.Object3D;
  private rwPylonRight!: THREE.Object3D;
  
  // Scratch vectors for zero-allocation scraping detection
  private _scratchWingL = new THREE.Vector3();
  private _scratchWingR = new THREE.Vector3();
  
  // High-Fidelity Multi-Octave Aeroelastic Physical Oscillator States (Zero GC)
  private wingFlutterTime: number = 0;
  private rearWingOscAngle = { roll: 0, pitch: 0, yaw: 0, y: 0, z: 0 };
  private rearWingOscVel = { roll: 0, pitch: 0, yaw: 0, y: 0, z: 0 };
  private frontWingLeftOsc = { roll: 0, pitch: 0, y: 0 };
  private frontWingLeftVel = { roll: 0, pitch: 0, y: 0 };
  private frontWingRightOsc = { roll: 0, pitch: 0, y: 0 };
  private frontWingRightVel = { roll: 0, pitch: 0, y: 0 };
  private drsOscAngle = { roll: 0, pitch: 0 };
  private drsOscVel = { roll: 0, pitch: 0 };
  private gustTurbulence: number = 0;
  private gustTarget: number = 0;
  private gustTimer: number = 0;

  private noseMesh!: THREE.Mesh;
  private pristineNosePositions!: Float32Array;
  private lastAppliedCrumple: number = -1;
  private lastAppliedDamageHash: string = '';
  private lastCrumpleVal: number = -1;
  private lastLeftDmgVal: number = -1;
  private lastRightDmgVal: number = -1;
  private lastBrakeLit: boolean = false;
  private lastBrakeIntensity: number = -1;
  private lastActiveLeds: number = -1;

  // Exhaust System & Flame Shader
  private exhaustTips: THREE.Group[] = [];
  private exhaustFlameMaterials: THREE.ShaderMaterial[] = [];
  private exhaustFlameMeshes: THREE.Mesh[] = [];
  private exhaustGlowMat!: THREE.MeshStandardMaterial;
  private exhaustPointLight!: THREE.PointLight;
  private backfireState = { active: false, phaseTime: 0, totalDuration: 0.17, isHighRpm: false };
  private flameGlobalTime = 0;

  // Dynamic Lighting & Materials
  private headlightGlowMat!: THREE.MeshStandardMaterial;
  private taillightMaterial!: THREE.MeshStandardMaterial;
  private brakeDiscMaterial!: THREE.MeshStandardMaterial;
  private fiaRainLight!: THREE.MeshStandardMaterial;

  // Animated Racing Cockpit & Steering System
  private steeringWheelPivot!: THREE.Group;
  private steeringWheel!: THREE.Group;
  private driverHelmet!: THREE.Group;
  private helmetShellMat?: THREE.MeshPhysicalMaterial;
  private helmetVisorMat?: THREE.MeshPhysicalMaterial;
  private currentBrakeTemp: number = 0;
  private revLedMeshes: THREE.Mesh[] = [];
  private currentSteerAnim: number = 0;

  // Shared Performance Materials
  private bodyMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  private carbonMaterial!: THREE.MeshStandardMaterial;
  private carbonGlossMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  private mechanicalMetalMat!: THREE.MeshStandardMaterial;
  private haloMaterial!: THREE.MeshStandardMaterial;
  private goldMetalMat!: THREE.MeshStandardMaterial;
  private centerlockNuts: THREE.Mesh[] = [];
  public contactShadowMesh?: THREE.Mesh;
  private underbodyShadowTexture?: THREE.CanvasTexture;
  private underbodyShadowMaterial?: THREE.MeshBasicMaterial;

  // Smooth hydraulic suspension damping
  private currentWheelCompression: number[] = [0, 0, 0, 0];
  private cachedTireVisualStates: number[] = [-1, -1, -1, -1];

  // Procedural 2K/4K Livery Texture & Decals
  private liveryTexture!: THREE.CanvasTexture;
  private rearWingTexture!: THREE.CanvasTexture;
  private rearWingMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  private sharkFinTexture!: THREE.CanvasTexture;
  private sharkFinMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  private haloDecalTexture!: THREE.CanvasTexture;
  private haloDecalMaterial!: THREE.MeshStandardMaterial;
  private endplateDecalTexture!: THREE.CanvasTexture;
  private endplateDecalMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  private frontWingFlapTexture!: THREE.CanvasTexture;
  private frontWingFlapMaterial!: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;

  // Real-time F1 DRS Articulation & Hydraulic Actuator
  private drsPivotGroup!: THREE.Group;
  private drsLedMesh!: THREE.Mesh;
  private drsLedMaterial!: THREE.MeshStandardMaterial;
  private drsPistonMesh!: THREE.Mesh;
  private drsPointLight!: THREE.PointLight;
  private drsRockerArmLeft!: THREE.Mesh;
  private drsRockerArmRight!: THREE.Mesh;
  private currentDrsAngle: number = 0.12; // Initial state: 0.12 rad (Closed High Downforce Mode)
  private drsVelocity: number = 0;

  constructor(livery?: TeamLiveryConfig, isAi: boolean = false) {
    this.isAi = isAi;
    this.liveryConfig = livery || RACE_TEAMS[0];
    this.group = new THREE.Group();
    this.createLiveryTexture();
    this.initMaterials();
    this.buildCarBody();
    this.buildWheels();
    this.buildLights();
    this.buildExhausts();
    this.buildUnderbodyContactShadow();
    this.ensureCastShadows();
  }

  /**
   * Optimizes shadow casting: Only primary exterior aerodynamic body panels, wings,
   * and outer tires cast shadows. Eliminates over 75 tiny internal cockpit, LED, bolt,
   * caliper, and spoke draw calls per car in the shadow map pass!
   */
  public ensureCastShadows(): void {
    const shadowMaterials = new Set([
      this.bodyMaterial,
      this.haloMaterial,
      this.rearWingMaterial,
      this.frontWingFlapMaterial,
      this.carbonMaterial,
      this.carbonGlossMaterial,
    ]);

    this.proceduralBodyGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj === this.contactShadowMesh) {
          obj.castShadow = false;
        } else if (
          obj === this.noseMesh ||
          (Array.isArray(obj.material)
            ? obj.material.some((m) => shadowMaterials.has(m))
            : shadowMaterials.has(obj.material))
        ) {
          obj.castShadow = true;
        } else {
          obj.castShadow = false;
        }
      }
    });

    // For wheel assemblies: only the 4 outer rubber tires cast shadows into the shadow map
    this.wheelMeshes.forEach((wm) => {
      wm.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = this.tireMeshList.includes(obj);
        }
      });
    });

    this.customModelGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj !== this.contactShadowMesh) {
        obj.castShadow = true;
      }
    });
  }

  /**
   * Helper to draw text with heavy outer stroke for maximum contrast over any background
   */
  private drawOutlinedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fillColor: string,
    strokeColor: string = '#000000',
    strokeWidth: number = 0
  ): void {
    ctx.save();
    // High-precision vector typography without cartoon comic-book borders
    if (strokeWidth > 0 && strokeColor !== fillColor) {
      ctx.lineWidth = Math.min(0.75, strokeWidth * 0.05);
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = fillColor;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * Helper to draw the iconic Red Bull Charging Bull silhouette with golden solar disc
   */
  private drawChargingBull(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number = 1.0,
    withSun: boolean = true,
    facingLeft: boolean = false
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    if (facingLeft) ctx.scale(-1, 1);
    ctx.scale(scale, scale);

    if (withSun) {
      // Radiant golden solar disc with multi-stop radial gradient
      const sunGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 92);
      sunGrad.addColorStop(0, '#fffbeb');
      sunGrad.addColorStop(0.35, '#fef08a');
      sunGrad.addColorStop(0.70, '#facc15');
      sunGrad.addColorStop(1.0, '#eab308');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 86, 0, Math.PI * 2);
      ctx.fill();
    }

    // Leaping Bull Silhouette in charging attack posture (Championship Red Bull Crimson)
    ctx.fillStyle = '#cc0022';

    ctx.beginPath();
    ctx.moveTo(-115, -12); // tail tip
    ctx.quadraticCurveTo(-90, -48, -52, -36); // tail arch
    ctx.lineTo(-42, -26); // rump
    ctx.bezierCurveTo(-22, -68, 22, -78, 48, -52); // muscular shoulder hump
    ctx.lineTo(68, -46); // neck
    ctx.lineTo(88, -58); // horn base
    ctx.quadraticCurveTo(122, -92, 132, -74); // forward sweeping horn
    ctx.quadraticCurveTo(98, -62, 82, -36); // horn inner edge
    ctx.lineTo(98, -14); // lowered charging snout
    ctx.lineTo(76, 2);   // lower jaw & chin
    ctx.lineTo(62, -8);  // throat
    ctx.lineTo(56, 36);  // front lead charging leg
    ctx.lineTo(42, 36);
    ctx.lineTo(44, 6);
    ctx.lineTo(26, 42);  // second front leg
    ctx.lineTo(14, 42);
    ctx.lineTo(22, -4);  // chest
    ctx.bezierCurveTo(2, 12, -24, 14, -46, 2); // belly line
    ctx.lineTo(-66, 48); // rear hind leg
    ctx.lineTo(-80, 48);
    ctx.lineTo(-66, -4);
    ctx.lineTo(-92, 36); // second rear leg
    ctx.lineTo(-104, 36);
    ctx.lineTo(-86, -14); // flank
    ctx.closePath();
    ctx.fill();

    // Golden horn accent
    const hornGrad = ctx.createLinearGradient(88, -58, 132, -74);
    hornGrad.addColorStop(0, '#fef08a');
    hornGrad.addColorStop(1, '#eab308');
    ctx.fillStyle = hornGrad;
    ctx.beginPath();
    ctx.moveTo(88, -58);
    ctx.quadraticCurveTo(122, -92, 132, -74);
    ctx.quadraticCurveTo(98, -62, 82, -36);
    ctx.closePath();
    ctx.fill();

    // Eye glint
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(76, -26, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Procedural 2K Master Red Bull F1 Livery & Technical Sponsor Decals
   */
  private createLiveryTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;
    const cfg = this.liveryConfig;

    // 1. Base Layer: Authentic Red Bull Matte Midnight Navy Blue (#040814)
    ctx.fillStyle = cfg.primaryColor || '#040814';
    ctx.fillRect(0, 0, 2048, 2048);

    // Subtle satin curvature highlight across the aerodynamic fuselage
    const flankGrad = ctx.createLinearGradient(0, 0, 2048, 0);
    flankGrad.addColorStop(0.0, 'rgba(0,0,0,0.65)');
    flankGrad.addColorStop(0.18, 'rgba(0,0,0,0.12)');
    flankGrad.addColorStop(0.25, 'rgba(12,24,48,0.30)'); // Top spine subtle navy highlight
    flankGrad.addColorStop(0.35, 'rgba(0,0,0,0.12)');
    flankGrad.addColorStop(0.50, 'rgba(0,0,0,0.50)'); // Flank
    flankGrad.addColorStop(0.75, 'rgba(0,0,0,0.95)'); // Floor
    flankGrad.addColorStop(1.0, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = flankGrad;
    ctx.fillRect(0, 0, 2048, 2048);

    // 2. Micro Carbon Fiber Weave Texture on Floor & Skirt Zones (2x2 Twill)
    ctx.fillStyle = 'rgba(5,7,10,0.98)';
    ctx.fillRect(0, 1650, 2048, 398);
    ctx.fillRect(0, 0, 2048, 120);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2048; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 1650);
      ctx.lineTo(i + 300, 2048);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - 150, 120);
      ctx.stroke();
    }

    // 3. Iconic Red Bull Aerodynamic Speed Chevrons (Championship Crimson & Electric Sunburst Yellow)
    // Red Dynamic Flank Chevrons
    ctx.fillStyle = cfg.secondaryColor || '#cc0022';
    ctx.beginPath();
    ctx.moveTo(512, 190);
    ctx.lineTo(630, 620);
    ctx.lineTo(650, 1800);
    ctx.lineTo(374, 1800);
    ctx.lineTo(394, 620);
    ctx.closePath();
    ctx.fill();

    // Sunburst Yellow Accent Pinstripes
    ctx.fillStyle = cfg.accentColor || '#fec008';
    ctx.fillRect(504, 160, 16, 1750);
    ctx.fillRect(424, 280, 8, 1500);
    ctx.fillRect(592, 280, 8, 1500);

    // Aerodynamic cooling gills / louver stencils along sidepod top
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    for (let l = 0; l < 9; l++) {
      const ly = 960 + l * 28;
      ctx.fillRect(350, ly, 75, 8);
      ctx.fillRect(623, ly, 75, 8);
    }

    // Halftone Speed Dots Matrix (Aero Flow Surface Streamlines)
    ctx.fillStyle = cfg.accentColor || '#fec008';
    for (let row = 0; row < 12; row++) {
      const dotY = 700 + row * 45;
      const radius = 9 - row * 0.65;
      if (radius > 0) {
        ctx.beginPath();
        ctx.arc(370 - row * 10, dotY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(654 + row * 10, dotY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // =========================================================================
    // TOP SPINE GRAPHICS (u = 0.25 -> X = 512, fully visible from above and front)
    // =========================================================================

    // A. Iconic Sunburst Yellow Nose Tip Wedge
    ctx.save();
    ctx.fillStyle = '#fec008';
    ctx.beginPath();
    ctx.moveTo(430, 120);
    ctx.lineTo(594, 120);
    ctx.lineTo(570, 240);
    ctx.lineTo(512, 260);
    ctx.lineTo(454, 240);
    ctx.closePath();
    ctx.fill();

    // Tow hook marker
    ctx.font = 'bold 20px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    this.drawOutlinedText(ctx, '▲ TOW HOOK', 512, 170, '#cc0022', '#000000', 0);
    ctx.restore();

    // B. Dual Leaping Red Bulls & Sun on Nosecone (y = 310)
    this.drawChargingBull(ctx, 435, 310, 0.42, true, false);
    this.drawChargingBull(ctx, 589, 310, 0.42, true, true);

    // C. Official Competition Racing Number Plaque on Nosecone (y = 425)
    ctx.save();
    ctx.translate(512, 425);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-120, -75, 240, 150, 22);
    ctx.fill();

    const dNum = cfg.driverNumber ? (cfg.driverNumber.length === 1 ? '0' + cfg.driverNumber : cfg.driverNumber) : '01';
    ctx.font = 'italic 900 115px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#050a16';
    ctx.fillText(dNum, 0, -6);

    ctx.font = 'bold 20px "Chakra Petch", sans-serif';
    const driverLabel = `[ ${cfg.driverCode || 'VER'} ] ${cfg.driverName || 'VERSTAPPEN'}`.toUpperCase();
    ctx.fillStyle = '#cc0022';
    ctx.fillText(driverLabel, 0, 56);
    ctx.restore();

    // D. Official FIA Scrutineering & Technical Homologation Badge (y = 545)
    ctx.save();
    ctx.translate(512, 545);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-140, -20, 280, 40);
    ctx.font = 'bold italic 20px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#050a16';
    ctx.fillText('FIA 2026 HOMOLOGATED', 0, 0);
    ctx.restore();

    // E. Red Bull Official Technical Sponsor Cascade on Nosecone
    const noseSponsors = [
      { name: 'ORACLE', y: 630, size: 56, color: '#ffffff' },
      { name: 'HONDA HRC', y: 705, size: 48, color: '#cc0022' },
      { name: 'MOBIL 1', y: 775, size: 44, color: '#ffffff' },
      { name: 'TAG HEUER', y: 840, size: 40, color: '#fec008' },
      { name: 'PIRELLI P-ZERO', y: 900, size: 38, color: '#fec008' },
      { name: 'BYBIT', y: 955, size: 34, color: '#ffffff' },
    ];
    noseSponsors.forEach((sp) => {
      ctx.save();
      ctx.font = `italic 900 ${sp.size}px "Chakra Petch", "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = sp.color;
      ctx.fillText(sp.name, 512, sp.y);
      ctx.restore();
    });

    // F. Safety Badges (Emergency Cut-Off & High Voltage)
    ctx.save();
    ctx.translate(512, 1050);
    ctx.fillStyle = '#cc0022';
    ctx.beginPath();
    ctx.arc(-220, 0, 24, 0, Math.PI * 2);
    ctx.arc(220, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 28px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('E', -220, 1);
    ctx.fillText('E', 220, 1);
    ctx.restore();

    // G. Engine Cover Spine Graphics (y = 1180 to 1850, directly visible in third-person chase cam)
    ctx.save();
    ctx.translate(512, 1260);

    // Radiant Gold Sunburst Ring behind Bull
    const spineSunGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 120);
    spineSunGrad.addColorStop(0, '#fef08a');
    spineSunGrad.addColorStop(0.5, '#facc15');
    spineSunGrad.addColorStop(1.0, '#eab308');
    ctx.fillStyle = spineSunGrad;
    ctx.beginPath();
    ctx.arc(0, -10, 110, 0, Math.PI * 2);
    ctx.fill();

    // Large Leaping Red Bull Charging into battle
    this.drawChargingBull(ctx, 0, -10, 0.95, false, false);

    // Bold High-Contrast "RED BULL" in Pure Championship White (Zero Comic Stroke)
    ctx.font = 'italic 900 96px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RED BULL', 0, 110);

    // Power Unit Logo
    ctx.font = 'bold italic 36px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#fec008';
    ctx.fillText('HONDA RBPT HYBRID V6', 0, 168);

    // Driver Number Badge on Engine Deck
    const dNumSpine = cfg.driverNumber || '1';
    ctx.font = 'italic 900 84px "Chakra Petch", "Arial Black", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`#${dNumSpine}`, 0, 240);

    ctx.restore();

    // =========================================================================
    // FLANK TITLE SPONSORS & TECHNICAL BADGES (Sidepods)
    // Left Flank (u = 0.50 -> X = 1024) & Right Flank (u ≈ 0.05 -> X = 150)
    // =========================================================================
    [1024, 150].forEach((xPos, idx) => {
      ctx.save();
      ctx.translate(xPos, 1250);
      ctx.rotate(idx === 0 ? -Math.PI / 2 : Math.PI / 2);

      // Huge Bold White "ORACLE" title exactly like real Red Bull F1 car
      ctx.font = 'italic 900 114px "Chakra Petch", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('ORACLE', 0, -35);

      // Championship Crimson Red speed underline
      ctx.fillStyle = '#cc0022';
      ctx.fillRect(-320, 22, 640, 8);

      // "RED BULL RACING" subtitle
      ctx.font = 'italic 900 46px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#fec008';
      ctx.fillText('RED BULL RACING', 0, 58);

      // Technical partners stack
      ctx.font = 'italic bold 26px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('MOBIL 1  |  HONDA HRC  |  TAG HEUER  |  BYBIT', 0, 100);
      ctx.restore();

      // Skirt safety decals
      ctx.save();
      ctx.translate(xPos, 1680);
      ctx.rotate(idx === 0 ? -Math.PI / 2 : Math.PI / 2);
      ctx.font = 'bold 22px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#fec008';
      ctx.fillText('▼ LIFT HERE', -200, 0);
      ctx.fillText('▼ LIFT HERE', 200, 0);
      ctx.fillStyle = '#cc0022';
      ctx.fillText('⚡ HIGH VOLTAGE 800V', 0, 0);
      ctx.restore();
    });

    this.liveryTexture = new THREE.CanvasTexture(canvas);
    this.liveryTexture.generateMipmaps = true;
    this.liveryTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.liveryTexture.magFilter = THREE.LinearFilter;
    this.liveryTexture.anisotropy = 16;
    this.liveryTexture.colorSpace = THREE.SRGBColorSpace;
  }

  /**
   * Procedural Rear Wing DRS Banner Texture (2048 x 256 high-definition, calibrated aspect ratio)
   */
  private createRearWingDecalTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Deep Midnight Navy base
    ctx.fillStyle = '#040814';
    ctx.fillRect(0, 0, 2048, 256);

    // Subtle Carbon Fiber Weave Texture
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1.5;
    for (let i = -256; i < 2048; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();
    }

    // Top DRS Active Green Status Strip (thin 8px strip)
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, 0, 2048, 8);

    // Left & Right Flank Racing Chevrons in Dark Navy with Crimson Accent
    // Left Flank
    ctx.fillStyle = '#081426';
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(260, 8);
    ctx.lineTo(160, 256);
    ctx.lineTo(0, 256);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#cc0022';
    ctx.beginPath();
    ctx.moveTo(260, 8);
    ctx.lineTo(285, 8);
    ctx.lineTo(185, 256);
    ctx.lineTo(160, 256);
    ctx.closePath();
    ctx.fill();

    // Right Flank
    ctx.fillStyle = '#081426';
    ctx.beginPath();
    ctx.moveTo(2048, 8);
    ctx.lineTo(1788, 8);
    ctx.lineTo(1888, 256);
    ctx.lineTo(2048, 256);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#cc0022';
    ctx.beginPath();
    ctx.moveTo(1788, 8);
    ctx.lineTo(1763, 8);
    ctx.lineTo(1863, 256);
    ctx.lineTo(1888, 256);
    ctx.closePath();
    ctx.fill();

    // Flanking Charging Bulls beside the central title (prominent scale 0.42)
    this.drawChargingBull(ctx, 420, 128, 0.42, true, false);
    this.drawChargingBull(ctx, 1628, 128, 0.42, true, true);

    // Central Huge Bold Italic "RED BULL" in Pure Championship White (No Cartoon Outline)
    ctx.font = 'italic 900 128px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RED BULL', 1024, 115);

    // Lower Sponsors & DRS Telemetry Bar (Clean Platinum White)
    ctx.font = 'bold italic 24px "Chakra Petch", sans-serif';
    const subtitle = 'ORACLE  •  HONDA HRC  •  MOBIL 1  •  TAG HEUER  •  DRS ACTIVE';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(subtitle, 1024, 218);

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Procedural Dorsal Shark Fin (Aleta de Tiburón) with Golden Sun and Leaping Red Bull (1024 x 512)
   */
  private createSharkFinDecalTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const cfg = this.liveryConfig;

    // Dark midnight navy base
    ctx.fillStyle = '#050a16';
    ctx.fillRect(0, 0, 1024, 512);

    // Carbon fiber micro-weave
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    for (let i = -512; i < 1024; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 512, 512);
      ctx.stroke();
    }

    // Dynamic aerodynamic sweep in Red Bull Crimson & Sunburst Yellow
    ctx.fillStyle = '#d90429';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1024, 180);
    ctx.lineTo(1024, 512);
    ctx.lineTo(240, 512);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffd000';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1024, 165);
    ctx.lineTo(1024, 190);
    ctx.lineTo(0, 25);
    ctx.closePath();
    ctx.fill();

    // The iconic Golden Sun Disc and Leaping Red Bull silhouette on the Shark Fin
    this.drawChargingBull(ctx, 420, 240, 1.25, true, false);

    // Bold "RED BULL" in pure white
    ctx.font = 'italic 900 86px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RED BULL', 420, 390);

    // Driver Number on the right section of the shark fin
    const dNum = cfg.driverNumber ? (cfg.driverNumber.length === 1 ? '0' + cfg.driverNumber : cfg.driverNumber) : '01';
    ctx.font = 'italic 900 160px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(dNum, 850, 250);

    // Driver Badge
    ctx.font = 'bold 32px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#fec008';
    ctx.fillText(`🏁 [ ${cfg.driverCode || 'VER'} ]`, 850, 360);

    // Engine supplier
    ctx.font = 'italic 900 40px "Chakra Petch", "Arial Black", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('HONDA RBPT', 420, 75);

    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('ORACLE  •  MOBIL 1  •  TAG HEUER', 800, 75);

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Procedural Halo Top Fairing Decal (512 x 128)
   */
  private createHaloDecalTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const cfg = this.liveryConfig;

    ctx.fillStyle = '#040814';
    ctx.fillRect(0, 0, 512, 128);

    ctx.fillStyle = '#fec008';
    ctx.fillRect(0, 0, 512, 8);
    ctx.fillStyle = '#cc0022';
    ctx.fillRect(0, 120, 512, 8);

    ctx.font = 'italic 900 36px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`ORACLE • RED BULL RACING • #${cfg.driverNumber || '1'}`, 256, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Procedural Wing Endplate Decal (512 x 512)
   */
  private createEndplateDecalTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const cfg = this.liveryConfig;

    ctx.fillStyle = '#040814';
    ctx.fillRect(0, 0, 512, 512);

    // Continuous carbon weave pattern across the entire endplate surface
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1.5;
    for (let i = -512; i < 512; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 512, 512);
      ctx.stroke();
    }

    ctx.strokeStyle = '#cc0022';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, 480, 480);

    // Dark Navy Blue accent bar
    ctx.fillStyle = '#081426';
    ctx.fillRect(16, 16, 480, 16);

    // Vertical Sponsor Stack
    const sponsors = [
      { text: 'MOBIL 1', color: '#ffffff', size: 50 },
      { text: 'HONDA HRC', color: '#cc0022', size: 46 },
      { text: 'PIRELLI', color: '#ffffff', size: 44 },
      { text: 'ORACLE', color: '#ffffff', size: 40 },
      { text: `#${cfg.driverNumber || '1'}`, color: '#fec008', size: 58 },
    ];

    sponsors.forEach((sp, i) => {
      ctx.font = `italic 900 ${sp.size}px "Chakra Petch", "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = sp.color;
      ctx.fillText(sp.text, 256, 85 + i * 85);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Procedural Front Wing Flap Decal Texture (2048 x 256 high density)
   */
  private createFrontWingFlapTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Deep Midnight Navy base
    ctx.fillStyle = '#040814';
    ctx.fillRect(0, 0, 2048, 256);

    // Carbon weave overlay
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1.5;
    for (let i = -256; i < 2048; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();
    }

    // Leading edge Sunburst Yellow speed strip
    ctx.fillStyle = '#fec008';
    ctx.fillRect(0, 0, 2048, 16);

    // Dynamic Crimson accent pinstripes
    ctx.fillStyle = '#cc0022';
    ctx.fillRect(0, 16, 2048, 8);
    ctx.fillRect(0, 240, 2048, 16);

    // Left Flap Sponsors
    ctx.font = 'italic 900 68px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ORACLE', 420, 130);

    // Center Red Bull Racing & Charging Bull
    this.drawChargingBull(ctx, 920, 130, 0.38, true, false);
    ctx.font = 'italic 900 82px "Chakra Petch", "Arial Black", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RED BULL', 1080, 130);

    // Right Flap Sponsors
    ctx.font = 'italic 900 64px "Chakra Petch", "Arial Black", sans-serif';
    ctx.fillStyle = '#fec008';
    ctx.fillText('HONDA HRC', 1620, 130);

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private static sidewallTextureCache = new Map<string, THREE.CanvasTexture>();
  private static radialBlurTextureCache = new Map<string, THREE.CanvasTexture>();
  private static sharedTreadNormalTexture?: THREE.CanvasTexture;
  private static sharedMetallicFlakeTexture?: THREE.CanvasTexture;

  /**
   * Deep cleanup of static cached tire textures
   */
  public static clearTireTextureCache(): void {
    CarModel.sidewallTextureCache.forEach((tex) => tex.dispose());
    CarModel.sidewallTextureCache.clear();
    CarModel.radialBlurTextureCache.forEach((tex) => tex.dispose());
    CarModel.radialBlurTextureCache.clear();
    if (CarModel.sharedTreadNormalTexture) {
      CarModel.sharedTreadNormalTexture.dispose();
      CarModel.sharedTreadNormalTexture = undefined;
    }
    if (CarModel.sharedMetallicFlakeTexture) {
      CarModel.sharedMetallicFlakeTexture.dispose();
      CarModel.sharedMetallicFlakeTexture = undefined;
    }
  }

  /**
   * Procedural High-Speed Radial Motion Blur Texture for Rims and Sidewalls
   * Blends rotating metallic brushed highlights, compound speed rings, and semi-transparent
   * spoke fan to eliminate temporal wagon-wheel aliasing and transmit blistering rotational velocity.
   */
  private createWheelRadialBlurTexture(compoundColor: string): THREE.CanvasTexture {
    if (CarModel.radialBlurTextureCache.has(compoundColor)) {
      return CarModel.radialBlurTextureCache.get(compoundColor)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const cx = 256;
    const cy = 256;

    ctx.clearRect(0, 0, 512, 512);

    // 1. Sidewall Compound High-Speed Color Blur Ring (R: 165 to 205)
    const ringGrad = ctx.createRadialGradient(cx, cy, 160, cx, cy, 210);
    ringGrad.addColorStop(0.0, 'rgba(20, 20, 24, 0.0)');
    ringGrad.addColorStop(0.25, compoundColor + '55');
    ringGrad.addColorStop(0.55, compoundColor + 'dd');
    ringGrad.addColorStop(0.85, compoundColor + '88');
    ringGrad.addColorStop(1.0, 'rgba(20, 20, 24, 0.0)');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 210, 0, Math.PI * 2);
    ctx.fill();

    // High-speed white sponsor text blur streaks (Pirelli motion trail)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 185, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 168, 0, Math.PI * 2);
    ctx.arc(cx, cy, 200, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Forged Rim Barrel Outer Lip Anisotropic Metallic Ring (R: 140 to 162)
    const rimLipGrad = ctx.createRadialGradient(cx, cy, 138, cx, cy, 162);
    rimLipGrad.addColorStop(0.0, 'rgba(28, 30, 36, 0.85)');
    rimLipGrad.addColorStop(0.4, 'rgba(64, 68, 80, 0.95)');
    rimLipGrad.addColorStop(0.7, 'rgba(120, 128, 148, 0.80)');
    rimLipGrad.addColorStop(1.0, 'rgba(20, 22, 26, 0.90)');
    ctx.fillStyle = rimLipGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 162, 0, Math.PI * 2);
    ctx.arc(cx, cy, 138, 0, Math.PI * 2, true);
    ctx.fill();

    // 3. 10-Spoke BBS High-Speed Spinning Fan with Anisotropic Radial Highlights
    // Semi-transparent (alpha ~0.55-0.70) so glowing carbon brake discs and Brembo calipers show through
    const spokeFanGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 140);
    spokeFanGrad.addColorStop(0.0, 'rgba(22, 24, 28, 0.85)');
    spokeFanGrad.addColorStop(0.3, 'rgba(38, 42, 50, 0.72)');
    spokeFanGrad.addColorStop(0.65, 'rgba(52, 56, 68, 0.65)');
    spokeFanGrad.addColorStop(0.92, 'rgba(32, 34, 42, 0.78)');
    spokeFanGrad.addColorStop(1.0, 'rgba(18, 20, 24, 0.0)');
    ctx.fillStyle = spokeFanGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.arc(cx, cy, 40, 0, Math.PI * 2, true);
    ctx.fill();

    // Metallic brushed radial streaks (Anisotropic specular rings)
    for (let r = 50; r <= 135; r += 9) {
      const alpha = 0.12 + Math.sin(r * 0.4) * 0.08;
      ctx.strokeStyle = `rgba(180, 195, 220, ${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Centerlock Nut Hub Shadow & Retention Ring
    const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 42);
    hubGrad.addColorStop(0.0, 'rgba(10, 12, 16, 0.95)');
    hubGrad.addColorStop(0.7, 'rgba(18, 20, 26, 0.80)');
    hubGrad.addColorStop(1.0, 'rgba(24, 26, 32, 0.0)');
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;

    CarModel.radialBlurTextureCache.set(compoundColor, tex);
    return tex;
  }

  /**
   * Procedural Competition Slick Tread Micro-Texture & Normal Map
   * Provides realistic directional optical flow, mold parting lines, and vulcanized rubber pores.
   */
  private static getTreadNormalTexture(): THREE.CanvasTexture {
    if (CarModel.sharedTreadNormalTexture) return CarModel.sharedTreadNormalTexture;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Circumferential directional grain (smooth along Y, fine micro-variation along X)
        const grain = (Math.sin(x * 0.8) * 0.4 + Math.sin(x * 2.2) * 0.3) * (0.8 + Math.random() * 0.2);
        const moldLine = Math.abs(x - size / 2) < 2 ? 0.8 : 0.0;
        
        const nx = (grain * 0.35 + moldLine * 0.4) * 0.6;
        const ny = 0.0; // Clean directional flow along tire rotation
        const nz = 1.0;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const idx = (y * size + x) * 4;
        
        d[idx] = Math.floor((nx / len * 0.5 + 0.5) * 255);
        d[idx + 1] = Math.floor((ny / len * 0.5 + 0.5) * 255);
        d[idx + 2] = Math.floor((nz / len * 0.5 + 0.5) * 255);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 18);
    tex.anisotropy = 16;
    tex.generateMipmaps = true;

    CarModel.sharedTreadNormalTexture = tex;
    return tex;
  }

  /**
   * Procedural High-Frequency Metallic Paint Sparkle Normal Map
   * Creates realistic micro-facet reflections on automotive clearcoat under direct sunlight
   */
  private static getMetallicFlakeTexture(): THREE.CanvasTexture {
    if (CarModel.sharedMetallicFlakeTexture) return CarModel.sharedMetallicFlakeTexture;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < size * size; i++) {
      const idx = i * 4;
      const nx = (Math.random() - 0.5) * 0.45;
      const ny = (Math.random() - 0.5) * 0.45;
      const nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      d[idx] = Math.floor((nx / len * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.floor((ny / len * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.floor((nz / len * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(64, 64);
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    CarModel.sharedMetallicFlakeTexture = tex;
    return tex;
  }

  /**
   * Procedural Pirelli P-Zero Competition Tire Sidewall Stencil
   * High-definition 1024x1024 vector texture with authentic tire markings and compound color rings
   */
  private createTireSidewallTexture(compoundColor: string): THREE.CanvasTexture {
    if (CarModel.sidewallTextureCache.has(compoundColor)) {
      return CarModel.sidewallTextureCache.get(compoundColor)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const cx = 512;
    const cy = 512;

    // 1. Deep vulcanized matte rubber background
    ctx.fillStyle = '#141519';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle micro-radial mold channels (concentric rubber texture)
    for (let r = 320; r <= 490; r += 6) {
      const alpha = 0.04 + (Math.sin(r * 0.25) + 1.0) * 0.02;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Official Pirelli Dual Compound Stripe System
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 415, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = compoundColor;
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.arc(cx, cy, 385, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.arc(cx, cy, 352, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Crisp High-Resolution Vector Stencils (Top & Bottom & Flanks)
    ctx.save();
    ctx.translate(cx, cy);

    ctx.font = 'italic 900 68px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PIRELLI', 0, -385);

    ctx.font = 'italic 900 58px "Chakra Petch", "Arial Black", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('P ZERO™', 0, 385);

    ctx.save();
    ctx.rotate(Math.PI / 2);
    ctx.font = 'bold 30px "Chakra Petch", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('305 / 670 - 18', 0, -385);
    ctx.restore();

    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'bold 30px "Chakra Petch", sans-serif';
    ctx.fillStyle = compoundColor;
    ctx.fillText('FIA • F1 2026 • C3', 0, -385);
    ctx.restore();

    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;

    CarModel.sidewallTextureCache.set(compoundColor, tex);
    return tex;
  }

  // Shared procedural carbon fiber weave texture (cached across all vehicles)
  private static sharedCarbonWeaveTexture?: THREE.CanvasTexture;
  private static getCarbonFiberWeaveTexture(): THREE.CanvasTexture {
    if (CarModel.sharedCarbonWeaveTexture) return CarModel.sharedCarbonWeaveTexture;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // True 2x2 twill carbon fiber weave with alternating angular normal shifts
        const cellX = Math.floor(x / 8);
        const cellY = Math.floor(y / 8);
        const isHorizontal = ((cellX + cellY) % 2 === 0);
        const u = (x % 8) / 8;
        const v = (y % 8) / 8;
        let nx = 0;
        let ny = 0;
        if (isHorizontal) {
          nx = Math.sin((u - 0.5) * Math.PI) * 0.7;
          ny = (v - 0.5) * 0.15;
        } else {
          nx = (u - 0.5) * 0.15;
          ny = Math.sin((v - 0.5) * Math.PI) * 0.7;
        }
        const nz = 1.0;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const idx = (y * size + x) * 4;
        d[idx] = Math.floor((nx / len * 0.5 + 0.5) * 255);
        d[idx + 1] = Math.floor((ny / len * 0.5 + 0.5) * 255);
        d[idx + 2] = Math.floor((nz / len * 0.5 + 0.5) * 255);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(36, 36);
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    CarModel.sharedCarbonWeaveTexture = tex;
    return tex;
  }

  /**
   * Initializes high-fidelity physical PBR materials with Red Bull satin-matte finish.
   * AI cars utilize optimized MeshStandardMaterial (eliminating multi-lobe clearcoat overhead).
   */
  private initMaterials(): void {
    const carbonWeave = CarModel.getCarbonFiberWeaveTexture();
    const flakeNormal = CarModel.getMetallicFlakeTexture();

    this.rearWingTexture = this.createRearWingDecalTexture();
    this.rearWingMaterial = this.isAi
      ? new THREE.MeshStandardMaterial({
          map: this.rearWingTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.26,
          envMapIntensity: 1.25,
        })
      : new THREE.MeshPhysicalMaterial({
          map: this.rearWingTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.25,
          clearcoat: 0.95,
          clearcoatRoughness: 0.03,
          ior: 1.50,
          reflectivity: 0.55,
          envMapIntensity: 1.40,
        });

    this.sharkFinTexture = this.createSharkFinDecalTexture();
    this.sharkFinMaterial = this.isAi
      ? new THREE.MeshStandardMaterial({
          map: this.sharkFinTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.26,
        })
      : new THREE.MeshPhysicalMaterial({
          map: this.sharkFinTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.25,
          clearcoat: 0.95,
          clearcoatRoughness: 0.03,
          ior: 1.50,
          reflectivity: 0.55,
          envMapIntensity: 1.40,
        });

    this.haloDecalTexture = this.createHaloDecalTexture();
    this.haloDecalMaterial = new THREE.MeshStandardMaterial({
      map: this.haloDecalTexture,
      color: 0xffffff,
      roughness: 0.24,
      metalness: 0.22,
      envMapIntensity: 1.35,
    });

    this.endplateDecalTexture = this.createEndplateDecalTexture();
    this.endplateDecalMaterial = this.isAi
      ? new THREE.MeshStandardMaterial({
          map: this.endplateDecalTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.24,
        })
      : new THREE.MeshPhysicalMaterial({
          map: this.endplateDecalTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.22,
          clearcoat: 0.95,
          clearcoatRoughness: 0.03,
          ior: 1.52,
          reflectivity: 0.6,
          envMapIntensity: 1.75,
        });

    this.frontWingFlapTexture = this.createFrontWingFlapTexture();
    this.frontWingFlapMaterial = this.isAi
      ? new THREE.MeshStandardMaterial({
          map: this.frontWingFlapTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.24,
        })
      : new THREE.MeshPhysicalMaterial({
          map: this.frontWingFlapTexture,
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.22,
          clearcoat: 0.95,
          clearcoatRoughness: 0.03,
          ior: 1.52,
          reflectivity: 0.6,
          envMapIntensity: 1.75,
        });

    this.drsLedMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      emissiveIntensity: 0.2,
      roughness: 0.2,
      metalness: 0.5,
    });

    // 1. Signature Red Bull Multi-Stage Automotive Metallic Paint with High-Index Clearcoat
    this.bodyMaterial = this.isAi
      ? new THREE.MeshStandardMaterial({
          map: this.liveryTexture,
          normalMap: flakeNormal,
          normalScale: new THREE.Vector2(0.040, 0.040),
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.28,
          envMapIntensity: 1.25,
        })
      : new THREE.MeshPhysicalMaterial({
          map: this.liveryTexture,
          normalMap: flakeNormal,
          normalScale: new THREE.Vector2(0.042, 0.042),
          color: 0xffffff,
          metalness: 0.08,
          roughness: 0.26,
          clearcoat: 0.95,
          clearcoatRoughness: 0.03,
          ior: 1.50,
          reflectivity: 0.55,
          envMapIntensity: 1.35,
        });

    // 2. Satin Pre-Preg Carbon Fiber (Floor, Diffuser, Wings, Wishbones)
    this.carbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x101317,
      normalMap: carbonWeave,
      normalScale: new THREE.Vector2(0.65, 0.65),
      metalness: 0.08,
      roughness: 0.50,
      envMapIntensity: 0.90,
    });

    // 3. High-Gloss Carbon Fiber (Halo, Aero Fins, Mirrors)
    this.carbonGlossMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0c0e12,
      normalMap: carbonWeave,
      normalScale: new THREE.Vector2(0.35, 0.35),
      metalness: 0.10,
      roughness: 0.18,
      clearcoat: 0.95,
      clearcoatRoughness: 0.03,
      ior: 1.52,
      envMapIntensity: 1.45,
    });

    // 4. Titanium Aerospace Alloy (Halo core & Wishbone pivots)
    this.haloMaterial = new THREE.MeshStandardMaterial({
      color: 0x242830,
      metalness: 0.94,
      roughness: 0.22,
      envMapIntensity: 1.35,
    });

    // 5. Mechanical Machined Steel (Calipers, bolts, spindles)
    this.mechanicalMetalMat = new THREE.MeshStandardMaterial({
      color: 0x8a94a6,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 1.20,
    });

    // 6. Inconel Gold Heat Shielding
    this.goldMetalMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.96,
      roughness: 0.18,
      envMapIntensity: 1.35,
    });

    // 7. Carbon-Ceramic Brake Disc with Thermal Glow
    this.brakeDiscMaterial = new THREE.MeshStandardMaterial({
      color: 0x202228,
      metalness: 0.22,
      roughness: 0.44,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
    });

    // 8. Dynamic Lights
    this.headlightGlowMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 3.5,
      roughness: 0.1,
    });

    this.taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0020,
      emissive: new THREE.Color(0xef4444),
      emissiveIntensity: 1.2,
      roughness: 0.15,
    });

    this.fiaRainLight = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: new THREE.Color(0xdc2626),
      emissiveIntensity: 2.8,
      roughness: 0.1,
    });

    this.exhaustGlowMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.95,
      roughness: 0.22,
      emissive: new THREE.Color(0xff4500),
      emissiveIntensity: 0.4,
    });
  }

  /**
   * Safe, ultra-high performance cylinder rod constructor (eliminates TubeGeometry Frenet frame singularities/NaNs)
   */
  private createRodMesh(
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    material: THREE.Material,
    radialSegments = 8,
    radiusBottom = radius
  ): THREE.Mesh {
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    if (length < 0.0001) return new THREE.Mesh();

    const geo = new THREE.CylinderGeometry(radius, radiusBottom, length, radialSegments);
    geo.translate(0, length / 2, 0);
    geo.rotateX(Math.PI / 2);

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(start);
    mesh.lookAt(end);
    return mesh;
  }

  private createRodGeometry(
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    radialSegments = 8,
    radiusBottom = radius
  ): THREE.BufferGeometry | null {
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    if (length < 0.0001) return null;

    const geo = new THREE.CylinderGeometry(radius, radiusBottom, length, radialSegments);
    geo.translate(0, length / 2, 0);
    geo.rotateX(Math.PI / 2);

    const dummy = new THREE.Object3D();
    dummy.position.copy(start);
    dummy.lookAt(end);
    dummy.updateMatrix();
    geo.applyMatrix4(dummy.matrix);
    return geo;
  }

  /**
   * Constructs an organic, continuous aerodynamic monocoque fuselage using cross-sectional lofting.
   */
  private createFuselageGeometry(): THREE.BufferGeometry {
    // 24 Axial Cross-Section Stations along Z from nose tip (z = 2.45) to tail (z = -1.60)
    const stations = [
      { z: 2.45,  yc: 0.18, rx: 0.06, ryt: 0.05, ryb: 0.04 }, // Nose Tip
      { z: 2.25,  yc: 0.22, rx: 0.11, ryt: 0.08, ryb: 0.06 }, // Front Wing Mount
      { z: 1.95,  yc: 0.27, rx: 0.18, ryt: 0.12, ryb: 0.08 }, // Nosecone Mid
      { z: 1.60,  yc: 0.32, rx: 0.25, ryt: 0.16, ryb: 0.11 }, // Front Bulkhead
      { z: 1.30,  yc: 0.36, rx: 0.32, ryt: 0.19, ryb: 0.13 }, // Front Suspension Bulkhead
      { z: 0.95,  yc: 0.40, rx: 0.38, ryt: 0.22, ryb: 0.15 }, // S-Duct / Vanity Panel
      { z: 0.65,  yc: 0.43, rx: 0.44, ryt: 0.24, ryb: 0.16 }, // Cockpit Coaming Front
      { z: 0.35,  yc: 0.45, rx: 0.48, ryt: 0.23, ryb: 0.17 }, // Cockpit Opening
      { z: 0.05,  yc: 0.46, rx: 0.48, ryt: 0.22, ryb: 0.17 }, // Cockpit Tub Mid
      { z: -0.18, yc: 0.52, rx: 0.44, ryt: 0.32, ryb: 0.17 }, // Airbox Base / Roll Hoop
      { z: -0.38, yc: 0.50, rx: 0.40, ryt: 0.28, ryb: 0.17 }, // Airbox Intake Rear
      { z: -0.65, yc: 0.46, rx: 0.38, ryt: 0.24, ryb: 0.16 }, // Engine Cover Forward
      { z: -0.92, yc: 0.42, rx: 0.34, ryt: 0.20, ryb: 0.15 }, // Engine Cover Mid
      { z: -1.20, yc: 0.38, rx: 0.28, ryt: 0.16, ryb: 0.14 }, // Coke-Bottle Taper
      { z: -1.45, yc: 0.35, rx: 0.22, ryt: 0.13, ryb: 0.12 }, // Rear Suspension Bay
      { z: -1.62, yc: 0.33, rx: 0.16, ryt: 0.10, ryb: 0.10 }, // Gearbox / Tailcone
    ];

    const radialSegments = 32;
    const axialCount = stations.length;
    const vertexCount = axialCount * radialSegments + 2; // +2 for pole caps

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices: number[] = [];

    // Generate vertices along cross-sectional rings
    let vIdx = 0;
    for (let a = 0; a < axialCount; a++) {
      const st = stations[a];
      const v = a / (axialCount - 1);

      for (let r = 0; r < radialSegments; r++) {
        const u = r / radialSegments;
        const angle = u * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Parametric cross-section with differential top/bottom radii and bottom flattening
        const radY = sinA >= 0 ? st.ryt : st.ryb;
        const x = cosA * st.rx;
        const y = st.yc + sinA * radY;
        const z = st.z;

        positions[vIdx * 3] = x;
        positions[vIdx * 3 + 1] = y;
        positions[vIdx * 3 + 2] = z;

        uvs[vIdx * 2] = u;
        uvs[vIdx * 2 + 1] = v;

        vIdx++;
      }
    }

    // Front Nose Cap Center Pole
    const frontPoleIdx = vIdx;
    positions[frontPoleIdx * 3] = 0;
    positions[frontPoleIdx * 3 + 1] = stations[0].yc;
    positions[frontPoleIdx * 3 + 2] = stations[0].z + 0.04;
    uvs[frontPoleIdx * 2] = 0.5;
    uvs[frontPoleIdx * 2 + 1] = 0.0;
    vIdx++;

    // Rear Tailcone Cap Center Pole
    const rearPoleIdx = vIdx;
    positions[rearPoleIdx * 3] = 0;
    positions[rearPoleIdx * 3 + 1] = stations[axialCount - 1].yc;
    positions[rearPoleIdx * 3 + 2] = stations[axialCount - 1].z - 0.04;
    uvs[rearPoleIdx * 2] = 0.5;
    uvs[rearPoleIdx * 2 + 1] = 1.0;

    // Generate quad-strip indices
    for (let a = 0; a < axialCount - 1; a++) {
      const ringA = a * radialSegments;
      const ringB = (a + 1) * radialSegments;

      for (let r = 0; r < radialSegments; r++) {
        const nextR = (r + 1) % radialSegments;

        const p1 = ringA + r;
        const p2 = ringA + nextR;
        const p3 = ringB + r;
        const p4 = ringB + nextR;

        indices.push(p1, p3, p2);
        indices.push(p2, p3, p4);
      }
    }

    // Front Nose Fan Triangles
    for (let r = 0; r < radialSegments; r++) {
      const nextR = (r + 1) % radialSegments;
      indices.push(frontPoleIdx, r, nextR);
    }

    // Rear Tailcone Fan Triangles
    const lastRing = (axialCount - 1) * radialSegments;
    for (let r = 0; r < radialSegments; r++) {
      const nextR = (r + 1) % radialSegments;
      indices.push(rearPoleIdx, lastRing + nextR, lastRing + r);
    }

    // Precalculate Hardware GPU Morph Targets for Zero-CPU Crash Deformations
    const morphCrumplePos = new Float32Array(positions.length);
    const morphLeftDentPos = new Float32Array(positions.length);
    const morphRightDentPos = new Float32Array(positions.length);

    for (let i = 0; i < vertexCount; i++) {
      const origX = positions[i * 3];
      const origY = positions[i * 3 + 1];
      const origZ = positions[i * 3 + 2];

      if (origZ > 0.8) {
        const zRatio = (origZ - 0.8) / 1.65;
        const crumpleAmount = 0.42 * zRatio;
        const dentNoise = Math.sin(origX * 9.5 + origY * 6.0) * 0.11;
        const lateralCrease = Math.cos(origY * 8.0) * 0.05;

        // Target 0: Symmetrical Crumple
        morphCrumplePos[i * 3] = origX + lateralCrease;
        morphCrumplePos[i * 3 + 1] = origY + Math.abs(dentNoise) * 0.55;
        morphCrumplePos[i * 3 + 2] = origZ - crumpleAmount;

        // Target 1: Asymmetric Left Impact Dent
        const leftSideFactor = 1.0 + (origX < 0 ? 0.85 : 0.0);
        morphLeftDentPos[i * 3] = origX - 0.14 * zRatio;
        morphLeftDentPos[i * 3 + 1] = origY + Math.abs(dentNoise) * 0.4;
        morphLeftDentPos[i * 3 + 2] = origZ - crumpleAmount * leftSideFactor;

        // Target 2: Asymmetric Right Impact Dent
        const rightSideFactor = 1.0 + (origX > 0 ? 0.85 : 0.0);
        morphRightDentPos[i * 3] = origX + 0.14 * zRatio;
        morphRightDentPos[i * 3 + 1] = origY + Math.abs(dentNoise) * 0.4;
        morphRightDentPos[i * 3 + 2] = origZ - crumpleAmount * rightSideFactor;
      } else {
        morphCrumplePos[i * 3] = origX;
        morphCrumplePos[i * 3 + 1] = origY;
        morphCrumplePos[i * 3 + 2] = origZ;

        morphLeftDentPos[i * 3] = origX;
        morphLeftDentPos[i * 3 + 1] = origY;
        morphLeftDentPos[i * 3 + 2] = origZ;

        morphRightDentPos[i * 3] = origX;
        morphRightDentPos[i * 3 + 1] = origY;
        morphRightDentPos[i * 3 + 2] = origZ;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    geo.morphAttributes.position = [
      new THREE.BufferAttribute(morphCrumplePos, 3),
      new THREE.BufferAttribute(morphLeftDentPos, 3),
      new THREE.BufferAttribute(morphRightDentPos, 3),
    ];

    return geo;
  }

  /**
   * Constructs sculpted organic sidepods (pontones) with undercut channels and Coke-bottle waist
   */
  private createSidepodGeometry(isRight: boolean): THREE.BufferGeometry {
    const side = isRight ? 1 : -1;
    // 12 cross sections along sidepod Z length
    const podStations = [
      { z: 0.62,  xc: 0.44, yc: 0.32, rx: 0.17, ry: 0.12 }, // Overbite Intake Mouth
      { z: 0.42,  xc: 0.48, yc: 0.33, rx: 0.20, ry: 0.14 }, // Forward Scoop
      { z: 0.15,  xc: 0.52, yc: 0.33, rx: 0.22, ry: 0.15 }, // Shoulder Maximum
      { z: -0.15, xc: 0.50, yc: 0.32, rx: 0.21, ry: 0.14 }, // Downwash Slide
      { z: -0.45, xc: 0.46, yc: 0.30, rx: 0.18, ry: 0.13 }, // Waist Entry
      { z: -0.75, xc: 0.40, yc: 0.27, rx: 0.15, ry: 0.11 }, // Coke-Bottle Waist
      { z: -1.05, xc: 0.34, yc: 0.24, rx: 0.12, ry: 0.09 }, // Rear Radiator Exit
      { z: -1.30, xc: 0.28, yc: 0.22, rx: 0.08, ry: 0.07 }, // Diffuser Flank Blend
    ];

    const radialSegments = 20;
    const axialCount = podStations.length;
    const vertexCount = axialCount * radialSegments + 2;

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices: number[] = [];

    let vIdx = 0;
    for (let a = 0; a < axialCount; a++) {
      const st = podStations[a];
      const v = a / (axialCount - 1);

      for (let r = 0; r < radialSegments; r++) {
        const u = r / radialSegments;
        const angle = u * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Undercut on bottom outer edge
        const undercut = (sinA < 0 && cosA * side > 0) ? 0.65 : 1.0;
        const x = (st.xc + cosA * st.rx * undercut) * side;
        const y = st.yc + sinA * st.ry * undercut;
        const z = st.z;

        positions[vIdx * 3] = x;
        positions[vIdx * 3 + 1] = y;
        positions[vIdx * 3 + 2] = z;

        uvs[vIdx * 2] = u;
        uvs[vIdx * 2 + 1] = v;

        vIdx++;
      }
    }

    // Front Intake Pole
    const frontPole = vIdx;
    positions[frontPole * 3] = podStations[0].xc * side;
    positions[frontPole * 3 + 1] = podStations[0].yc;
    positions[frontPole * 3 + 2] = podStations[0].z + 0.02;
    uvs[frontPole * 2] = 0.5;
    uvs[frontPole * 2 + 1] = 0.0;
    vIdx++;

    // Rear Exit Pole
    const rearPole = vIdx;
    positions[rearPole * 3] = podStations[axialCount - 1].xc * side;
    positions[rearPole * 3 + 1] = podStations[axialCount - 1].yc;
    positions[rearPole * 3 + 2] = podStations[axialCount - 1].z - 0.02;
    uvs[rearPole * 2] = 0.5;
    uvs[rearPole * 2 + 1] = 1.0;

    // Quad strips
    for (let a = 0; a < axialCount - 1; a++) {
      const ringA = a * radialSegments;
      const ringB = (a + 1) * radialSegments;

      for (let r = 0; r < radialSegments; r++) {
        const nextR = (r + 1) % radialSegments;
        const p1 = ringA + r;
        const p2 = ringA + nextR;
        const p3 = ringB + r;
        const p4 = ringB + nextR;

        if (side > 0) {
          indices.push(p1, p3, p2);
          indices.push(p2, p3, p4);
        } else {
          indices.push(p1, p2, p3);
          indices.push(p2, p4, p3);
        }
      }
    }

    // Cap triangles
    for (let r = 0; r < radialSegments; r++) {
      const nextR = (r + 1) % radialSegments;
      if (side > 0) {
        indices.push(frontPole, r, nextR);
        indices.push(rearPole, (axialCount - 1) * radialSegments + nextR, (axialCount - 1) * radialSegments + r);
      } else {
        indices.push(frontPole, nextR, r);
        indices.push(rearPole, (axialCount - 1) * radialSegments + r, (axialCount - 1) * radialSegments + nextR);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }

  /**
   * Builds the entire aerodynamic single-seater chassis
   */
  private buildCarBody(): void {
    const carBodyGroup = new THREE.Group();

    // =========================================================================
    // 1. CONTINUOUS LOFTED AERODYNAMIC MONOCOQUE FUSELAGE
    // =========================================================================
    const fuselageGeo = this.createFuselageGeometry();
    this.noseMesh = new THREE.Mesh(fuselageGeo, this.bodyMaterial);
    this.noseMesh.castShadow = true;
    this.noseMesh.receiveShadow = true;
    // Pre-expand bounding sphere to encompass all morph target displacements (0 runtime recomputations!)
    this.noseMesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.45, 0.8), 3.2);
    carBodyGroup.add(this.noseMesh);

    // Save pristine vertex coordinates for crash crumple simulation
    this.pristineNosePositions = new Float32Array(fuselageGeo.attributes.position.array);

    // Cockpit Opening Coaming Lip (Carbon Edge)
    const coamingGeo = new THREE.TorusGeometry(0.34, 0.020, 8, 28, Math.PI);
    coamingGeo.rotateX(Math.PI / 2);
    const coamingMesh = new THREE.Mesh(coamingGeo, this.carbonMaterial);
    coamingMesh.position.set(0, 0.54, 0.16);
    carBodyGroup.add(coamingMesh);

    // Aerodynamic Tinted Windscreen Deflector
    const screenGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.05, 18, 1, true, 0, Math.PI);
    screenGeo.rotateX(Math.PI / 2);
    const screenMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a0f18,
      roughness: 0.05,
      transmission: 0.85,
      thickness: 0.04,
      transparent: true,
      opacity: 0.75,
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 0.54, 0.44);
    carBodyGroup.add(screenMesh);

    // S-Duct Vanity Panel & Camera Pods
    const sDuctGeo = new THREE.BoxGeometry(0.18, 0.020, 0.26);
    const sDuctMesh = new THREE.Mesh(sDuctGeo, this.carbonGlossMaterial);
    sDuctMesh.position.set(0, 0.45, 0.88);
    carBodyGroup.add(sDuctMesh);

    const chassisCamGeos: THREE.BufferGeometry[] = [];
    [-0.20, 0.20].forEach((camX) => {
      const camGeo = new THREE.CylinderGeometry(0.016, 0.020, 0.08, 8);
      camGeo.rotateX(Math.PI / 2);
      camGeo.translate(camX, 0.42, 1.68);
      chassisCamGeos.push(camGeo);
    });
    const mergedChassisCams = safeMergeAndDispose(chassisCamGeos);
    if (mergedChassisCams) {
      const camMesh = new THREE.Mesh(mergedChassisCams, this.carbonGlossMaterial);
      carBodyGroup.add(camMesh);
    }

    // =========================================================================
    // 2. SCULPTED ORGANIC SIDEPODS WITH OVERBITE INTAKES & WATERSLIDE DECKS
    // =========================================================================
    [false, true].forEach((isRight) => {
      const side = isRight ? 1 : -1;
      const sidepodGeo = this.createSidepodGeometry(isRight);
      const sidepodMesh = new THREE.Mesh(sidepodGeo, this.bodyMaterial);
      sidepodMesh.castShadow = true;
      sidepodMesh.receiveShadow = true;
      carBodyGroup.add(sidepodMesh);

      // Deep Hollow Radiator Intake Duct (Internal Black Cavity)
      const intakeRingGeo = new THREE.TorusGeometry(0.13, 0.022, 8, 18);
      const intakeRing = new THREE.Mesh(intakeRingGeo, this.carbonGlossMaterial);
      intakeRing.position.set(side * 0.46, 0.33, 0.63);
      intakeRing.scale.set(1.2, 0.85, 1.0);
      carBodyGroup.add(intakeRing);

      const intakeDarkGeo = new THREE.CircleGeometry(0.12, 16);
      const intakeDark = new THREE.Mesh(intakeDarkGeo, new THREE.MeshBasicMaterial({ color: 0x05070a }));
      intakeDark.position.set(side * 0.46, 0.33, 0.61);
      intakeDark.scale.set(1.2, 0.85, 1.0);
      carBodyGroup.add(intakeDark);

      // Downwash Waterfall Cooling Gills (Batched Geometries)
      const gillGeos: THREE.BufferGeometry[] = [];
      for (let g = 0; g < 5; g++) {
        const gillGeo = new THREE.BoxGeometry(0.14, 0.008, 0.035);
        gillGeo.rotateY(side * 0.16);
        gillGeo.translate(side * 0.45, 0.43, -0.05 - g * 0.09);
        gillGeos.push(gillGeo);
      }
      const mergedGills = safeMergeAndDispose(gillGeos);
      if (mergedGills) {
        const gillMesh = new THREE.Mesh(mergedGills, this.carbonMaterial);
        carBodyGroup.add(gillMesh);
      }

      // Aerodynamic Rearview Mirrors
      const p1 = new THREE.Vector3(side * 0.32, 0.46, 0.40);
      const p2 = new THREE.Vector3(side * 0.48, 0.56, 0.42);
      const p3 = new THREE.Vector3(side * 0.56, 0.55, 0.42);
      const rod1 = this.createRodGeometry(p1, p2, 0.008, 6);
      const rod2 = this.createRodGeometry(p2, p3, 0.008, 6);
      const mirrorRodGeos = [rod1, rod2].filter((g): g is THREE.BufferGeometry => g !== null);
      const mergedMirrorRods = safeMergeAndDispose(mirrorRodGeos);
      if (mergedMirrorRods) {
        const mirrorRodMesh = new THREE.Mesh(mergedMirrorRods, this.carbonMaterial);
        carBodyGroup.add(mirrorRodMesh);
      }

      const mirrorHousingGeo = new THREE.BoxGeometry(0.12, 0.05, 0.06);
      const mirrorHousing = new THREE.Mesh(mirrorHousingGeo, this.carbonGlossMaterial);
      mirrorHousing.position.set(side * 0.56, 0.55, 0.42);
      mirrorHousing.rotation.y = -side * 0.15;
      carBodyGroup.add(mirrorHousing);

      const mirrorGlassGeo = new THREE.PlaneGeometry(0.10, 0.04);
      const mirrorGlassMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.05 });
      const mirrorGlass = new THREE.Mesh(mirrorGlassGeo, mirrorGlassMat);
      mirrorGlass.position.set(side * 0.56, 0.55, 0.388);
      mirrorGlass.rotation.y = Math.PI - side * 0.15;
      carBodyGroup.add(mirrorGlass);
    });

    // =========================================================================
    // 3. CONTINUOUS CURVED TITANIUM SAFETY HALO (Merged Single Batch)
    // =========================================================================
    const haloGroup = new THREE.Group();
    const haloGeos: THREE.BufferGeometry[] = [];

    // Central V-Strut (curved with 2 clean tubular sections)
    const v1 = new THREE.Vector3(0, 0.46, 0.50);
    const v2 = new THREE.Vector3(0, 0.62, 0.38);
    const v3 = new THREE.Vector3(0, 0.70, 0.24);
    const gv1 = this.createRodGeometry(v1, v2, 0.020, 10);
    const gv2 = this.createRodGeometry(v2, v3, 0.020, 10);
    if (gv1) haloGeos.push(gv1);
    if (gv2) haloGeos.push(gv2);

    // Horseshoe Arch (segmented smooth curved titanium ring)
    const archPts = [
      new THREE.Vector3(-0.28, 0.53, -0.22),
      new THREE.Vector3(-0.30, 0.69, 0.02),
      new THREE.Vector3(0, 0.70, 0.24),
      new THREE.Vector3(0.30, 0.69, 0.02),
      new THREE.Vector3(0.28, 0.53, -0.22),
    ];
    for (let i = 0; i < archPts.length - 1; i++) {
      const gSeg = this.createRodGeometry(archPts[i], archPts[i + 1], 0.022, 10);
      if (gSeg) haloGeos.push(gSeg);
      if (i > 0) {
        const jointGeo = new THREE.SphereGeometry(0.022, 10, 8);
        jointGeo.translate(archPts[i].x, archPts[i].y, archPts[i].z);
        haloGeos.push(jointGeo);
      }
    }

    const mergedHalo = safeMergeAndDispose(haloGeos);
    if (mergedHalo) {
      const haloMesh = new THREE.Mesh(mergedHalo, this.haloMaterial);
      haloMesh.castShadow = true;
      haloMesh.matrixAutoUpdate = false;
      haloMesh.updateMatrix();
      haloGroup.add(haloMesh);
    }

    // Halo Top Fairing
    const haloFairingGeo = new THREE.BoxGeometry(0.12, 0.012, 0.06);
    const haloFairingMesh = new THREE.Mesh(haloFairingGeo, this.carbonGlossMaterial);
    haloFairingMesh.position.set(0, 0.725, 0.24);
    haloGroup.add(haloFairingMesh);

    const haloDecalGeo = new THREE.PlaneGeometry(0.118, 0.058);
    haloDecalGeo.rotateX(-Math.PI / 2);
    const haloDecalMesh = new THREE.Mesh(haloDecalGeo, this.haloDecalMaterial);
    haloDecalMesh.position.set(0, 0.732, 0.24);
    haloGroup.add(haloDecalMesh);
    carBodyGroup.add(haloGroup);

    // =========================================================================
    // 4. OVERHEAD AIRBOX SCOOP & CARBON DORSAL SHARK FIN
    // =========================================================================
    const airboxRimGeo = new THREE.RingGeometry(0.06, 0.09, 16);
    const airboxRim = new THREE.Mesh(airboxRimGeo, this.carbonGlossMaterial);
    airboxRim.position.set(0, 0.76, 0.18);
    carBodyGroup.add(airboxRim);

    const airboxDarkGeo = new THREE.CircleGeometry(0.07, 16);
    const airboxDark = new THREE.Mesh(airboxDarkGeo, new THREE.MeshBasicMaterial({ color: 0x050508 }));
    airboxDark.position.set(0, 0.76, 0.17);
    carBodyGroup.add(airboxDark);

    // Ultra-Thin Carbon Dorsal Shark Fin extending to rear wing with High-Contrast Livery
    const sharkFinShape = new THREE.Shape();
    sharkFinShape.moveTo(0, 0.78);
    sharkFinShape.lineTo(-1.32, 0.74);
    sharkFinShape.lineTo(-1.42, 0.42);
    sharkFinShape.lineTo(0.05, 0.50);
    sharkFinShape.closePath();

    const sharkFinGeo = new THREE.ExtrudeGeometry(sharkFinShape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    });
    sharkFinGeo.rotateY(Math.PI / 2);

    // Compute precise planar UVs so the shark fin decal maps cleanly and sharply
    const sPos = sharkFinGeo.attributes.position;
    const sUvs = sharkFinGeo.attributes.uv;
    for (let i = 0; i < sPos.count; i++) {
      const z = sPos.getZ(i);
      const y = sPos.getY(i);
      // Fin length is from z = 0.05 (front) to z = -1.42 (rear) -> span 1.47
      const u = THREE.MathUtils.clamp((0.05 - z) / 1.47, 0, 1);
      // Fin height is from y = 0.42 (bottom) to y = 0.78 (top) -> span 0.36
      const v = THREE.MathUtils.clamp((y - 0.42) / 0.36, 0, 1);
      sUvs.setXY(i, u, v);
    }
    sUvs.needsUpdate = true;

    const sharkFinMesh = new THREE.Mesh(sharkFinGeo, this.sharkFinMaterial);
    sharkFinMesh.position.set(-0.008, 0, 0.12);
    sharkFinMesh.castShadow = true;
    carBodyGroup.add(sharkFinMesh);

    // =========================================================================
    // 5. STEPPED GROUND-EFFECT CARBON FLOOR & REAR VENTURI DIFFUSER (Batched)
    // =========================================================================
    const floorGeos: THREE.BufferGeometry[] = [];

    const floorGeo = new THREE.BoxGeometry(1.68, 0.032, 2.90);
    floorGeo.translate(0, 0.11, 0.05);
    floorGeos.push(floorGeo);

    const diffRampGeo = new THREE.PlaneGeometry(1.26, 0.78);
    diffRampGeo.rotateX(Math.PI / 2 - 0.28);
    diffRampGeo.translate(0, 0.19, -1.68);
    floorGeos.push(diffRampGeo);

    [-0.46, -0.16, 0.16, 0.46].forEach((fenceX) => {
      const fenceGeo = new THREE.BoxGeometry(0.016, 0.16, 0.70);
      fenceGeo.rotateX(-0.28);
      fenceGeo.translate(fenceX, 0.18, -1.68);
      floorGeos.push(fenceGeo);
    });

    const mergedFloor = safeMergeAndDispose(floorGeos);
    if (mergedFloor) {
      const floorMesh = new THREE.Mesh(mergedFloor, this.carbonMaterial);
      floorMesh.receiveShadow = true;
      floorMesh.castShadow = true;
      carBodyGroup.add(floorMesh);
    }

    // Longitudinal Floor Strakes (Batched high-gloss carbon)
    const strakeGeos: THREE.BufferGeometry[] = [];
    [-0.84, 0.84].forEach((sideX) => {
      const strakeGeo = new THREE.BoxGeometry(0.024, 0.055, 1.90);
      strakeGeo.translate(sideX, 0.13, 0.10);
      strakeGeos.push(strakeGeo);
    });
    const mergedStrakes = safeMergeAndDispose(strakeGeos);
    if (mergedStrakes) {
      const strakeMesh = new THREE.Mesh(mergedStrakes, this.carbonGlossMaterial);
      carBodyGroup.add(strakeMesh);
    }

    // =========================================================================
    // 6. ADVANCED GROUND-EFFECT MULTI-ELEMENT 3D FRONT WING ASSEMBLY
    // =========================================================================
    const frontWingGroup = new THREE.Group();
    this.frontWingGroup = frontWingGroup;

    this.frontWingLeftGroup = new THREE.Group();
    this.frontWingRightGroup = new THREE.Group();
    frontWingGroup.add(this.frontWingLeftGroup);
    frontWingGroup.add(this.frontWingRightGroup);

    // 6.1 Left and Right Modular Multi-Stage Front Wing Cascades
    [-1, 1].forEach((dir) => {
      const isRight = dir > 0;
      const targetSideGroup = isRight ? this.frontWingRightGroup : this.frontWingLeftGroup;

      const mainplaneGroup = new THREE.Group();
      const upperFlapsGroup = new THREE.Group();
      const endplateGroup = new THREE.Group();

      // Broken carbon fracture stub on nose root (revealed when mainplane is torn off)
      const stubGeo = new THREE.BoxGeometry(0.12, 0.038, 0.22);
      const stubMesh = new THREE.Mesh(stubGeo, this.carbonMaterial);
      stubMesh.position.set(isRight ? 0.14 : -0.14, 0.12, 2.18);
      stubMesh.rotation.y = isRight ? -0.15 : 0.15;
      stubMesh.visible = false;
      targetSideGroup.add(stubMesh);

      // --- SUB-ASSEMBLY A: Mainplane & Ground Effect Scoop (Elements 1 & 2) ---
      // Element 1: Mainplane half
      const fwMainGeo = new THREE.BoxGeometry(0.97, 0.026, 0.46, 16, 1, 8);
      const fwMainPos = fwMainGeo.attributes.position;
      for (let i = 0; i < fwMainPos.count; i++) {
        const localX = fwMainPos.getX(i);
        const globalX = isRight ? (localX + 0.485) : (localX - 0.485);
        const z = fwMainPos.getZ(i);
        const normX = Math.abs(globalX) / 0.97;
        
        const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.055;
        const chordNorm = (z + 0.23) / 0.46;
        const camberLift = Math.sin(chordNorm * Math.PI) * 0.018;
        const tipDihedral = Math.pow(normX, 3.0) * 0.028;

        fwMainPos.setY(i, fwMainPos.getY(i) + spoonDip + camberLift + tipDihedral);
        if (chordNorm > 0.7) {
          fwMainPos.setZ(i, z - Math.pow(normX, 2.2) * 0.06);
        }
      }
      fwMainGeo.computeVertexNormals();
      const fwMainMesh = new THREE.Mesh(fwMainGeo, this.carbonMaterial);
      fwMainMesh.position.set(isRight ? 0.485 : -0.485, 0.115, 2.22);
      fwMainMesh.castShadow = true;
      mainplaneGroup.add(fwMainMesh);

      // Element 2: Secondary Slotted Cascade Flap
      const fwFlap2Geo = new THREE.BoxGeometry(0.94, 0.018, 0.28, 14, 1, 6);
      const fwFlap2Pos = fwFlap2Geo.attributes.position;
      for (let i = 0; i < fwFlap2Pos.count; i++) {
        const localX = fwFlap2Pos.getX(i);
        const globalX = isRight ? (localX + 0.47) : (localX - 0.47);
        const normX = Math.abs(globalX) / 0.94;
        const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.048;
        const tipDihedral = Math.pow(normX, 3.0) * 0.025;
        fwFlap2Pos.setY(i, fwFlap2Pos.getY(i) + spoonDip + tipDihedral);
      }
      fwFlap2Geo.computeVertexNormals();
      const fwFlap2Mesh = new THREE.Mesh(fwFlap2Geo, this.carbonGlossMaterial);
      fwFlap2Mesh.position.set(isRight ? 0.47 : -0.47, 0.145, 2.12);
      fwFlap2Mesh.rotation.x = -0.12;
      fwFlap2Mesh.castShadow = true;
      mainplaneGroup.add(fwFlap2Mesh);

      // --- SUB-ASSEMBLY B: Upper Cascade Flaps & Sponsor Livery (Elements 3 & 4) ---
      // Element 3: Tertiary Downwash Flap
      const fwFlap3Geo = new THREE.BoxGeometry(0.92, 0.016, 0.22, 12, 1, 4);
      const fwFlap3Pos = fwFlap3Geo.attributes.position;
      for (let i = 0; i < fwFlap3Pos.count; i++) {
        const localX = fwFlap3Pos.getX(i);
        const globalX = isRight ? (localX + 0.46) : (localX - 0.46);
        const normX = Math.abs(globalX) / 0.92;
        const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.042;
        const tipDihedral = Math.pow(normX, 3.0) * 0.022;
        fwFlap3Pos.setY(i, fwFlap3Pos.getY(i) + spoonDip + tipDihedral);
      }
      fwFlap3Geo.computeVertexNormals();
      const fwFlap3Mesh = new THREE.Mesh(fwFlap3Geo, this.bodyMaterial);
      fwFlap3Mesh.position.set(isRight ? 0.46 : -0.46, 0.175, 2.04);
      fwFlap3Mesh.rotation.x = -0.19;
      fwFlap3Mesh.castShadow = true;
      upperFlapsGroup.add(fwFlap3Mesh);

      // Element 4: Top Flap with Decal Banner
      const fwTopFlapGeo = new THREE.BoxGeometry(0.90, 0.015, 0.18, 12, 1, 4);
      const fwTopFlapPos = fwTopFlapGeo.attributes.position;
      for (let i = 0; i < fwTopFlapPos.count; i++) {
        const localX = fwTopFlapPos.getX(i);
        const globalX = isRight ? (localX + 0.45) : (localX - 0.45);
        const normX = Math.abs(globalX) / 0.90;
        const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.038;
        const tipDihedral = Math.pow(normX, 3.0) * 0.020;
        fwTopFlapPos.setY(i, fwTopFlapPos.getY(i) + spoonDip + tipDihedral);
      }
      fwTopFlapGeo.computeVertexNormals();
      const fwTopFlapMesh = new THREE.Mesh(fwTopFlapGeo, this.frontWingFlapMaterial);
      fwTopFlapMesh.position.set(isRight ? 0.45 : -0.45, 0.205, 1.96);
      fwTopFlapMesh.rotation.x = -0.25;
      fwTopFlapMesh.castShadow = true;
      upperFlapsGroup.add(fwTopFlapMesh);

      // Gurney Lip
      const gurneyGeo = new THREE.BoxGeometry(0.89, 0.008, 0.006);
      const gurneyMesh = new THREE.Mesh(gurneyGeo, this.carbonGlossMaterial);
      gurneyMesh.position.set(isRight ? 0.45 : -0.45, 0.228, 1.88);
      upperFlapsGroup.add(gurneyMesh);

      // Slot-gap Separators per side
      (isRight ? [0.20, 0.42, 0.68] : [-0.68, -0.42, -0.20]).forEach((bx) => {
        const bracketGeo = new THREE.BoxGeometry(0.008, 0.08, 0.28);
        const bracketMesh = new THREE.Mesh(bracketGeo, this.mechanicalMetalMat);
        bracketMesh.position.set(bx, 0.165, 2.05);
        upperFlapsGroup.add(bracketMesh);
      });

      // --- SUB-ASSEMBLY C: Sculpted 3D Outwash Endplate & Dive Planes ---
      const sideX = isRight ? 0.97 : -0.97;
      const epShape = new THREE.Shape();
      epShape.moveTo(0, 0.03);
      epShape.lineTo(0.54, 0.04);
      epShape.lineTo(0.48, 0.32);
      epShape.lineTo(0.04, 0.28);
      epShape.quadraticCurveTo(-0.04, 0.18, 0, 0.03);

      const epGeo = new THREE.ExtrudeGeometry(epShape, {
        depth: 0.016,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.003,
        bevelSegments: 2,
      });
      epGeo.rotateY(Math.PI / 2);
      
      const epPos = epGeo.attributes.position;
      for (let i = 0; i < epPos.count; i++) {
        const y = epPos.getY(i);
        if (y > 0.15) {
          epPos.setX(i, epPos.getX(i) + (isRight ? 1 : -1) * (y - 0.15) * 0.18);
        }
      }
      epGeo.computeVertexNormals();

      const epMesh = new THREE.Mesh(epGeo, this.endplateDecalMaterial);
      epMesh.position.set(sideX, 0.05, 2.38);
      epMesh.castShadow = true;
      endplateGroup.add(epMesh);

      // Canard / Dive Plane
      const canardShape = new THREE.Shape();
      canardShape.moveTo(0, 0);
      canardShape.lineTo(0.24, 0.02);
      canardShape.quadraticCurveTo(0.18, 0.08, 0, 0.06);
      canardShape.closePath();
      const canardGeo = new THREE.ExtrudeGeometry(canardShape, { depth: 0.006, bevelEnabled: false });
      canardGeo.rotateY(isRight ? Math.PI / 2 : -Math.PI / 2);
      const canardMesh = new THREE.Mesh(canardGeo, this.carbonGlossMaterial);
      canardMesh.position.set(sideX + (isRight ? 0.02 : -0.02), 0.18, 2.24);
      canardMesh.rotation.z = isRight ? -0.22 : 0.22;
      endplateGroup.add(canardMesh);

      // Footplate Tunnel
      const footGeo = new THREE.BoxGeometry(0.065, 0.008, 0.50);
      const footMesh = new THREE.Mesh(footGeo, this.carbonMaterial);
      footMesh.position.set(sideX + (isRight ? 0.026 : -0.026), 0.065, 2.12);
      endplateGroup.add(footMesh);

      // Vortex Louvers
      for (let sl = 0; sl < 3; sl++) {
        const slatGeo = new THREE.BoxGeometry(0.006, 0.018, 0.08);
        const slatMesh = new THREE.Mesh(slatGeo, this.carbonMaterial);
        slatMesh.position.set(sideX, 0.16 + sl * 0.035, 1.86);
        slatMesh.rotation.x = 0.35;
        endplateGroup.add(slatMesh);
      }

      if (isRight) {
        this.frontWingRightMainGroup = mainplaneGroup;
        this.frontWingRightUpperFlapGroup = upperFlapsGroup;
        this.endplateRightGroup = endplateGroup;
        this.frontWingRightStubMesh = stubMesh;
      } else {
        this.frontWingLeftMainGroup = mainplaneGroup;
        this.frontWingLeftUpperFlapGroup = upperFlapsGroup;
        this.endplateLeftGroup = endplateGroup;
        this.frontWingLeftStubMesh = stubMesh;
      }

      targetSideGroup.add(mainplaneGroup);
      targetSideGroup.add(upperFlapsGroup);
      targetSideGroup.add(endplateGroup);
    });

    // 6.7 Central Nose Mounting Pylons & FIA Camera Pods (Batched)
    const pylonGeos: THREE.BufferGeometry[] = [];
    [-0.11, 0.11].forEach((pylonX) => {
      const p1 = new THREE.Vector3(pylonX, 0.34, 2.05);
      const p2 = new THREE.Vector3(pylonX * 1.15, 0.11, 2.22);
      const g = this.createRodGeometry(p1, p2, 0.016, 8);
      if (g) pylonGeos.push(g);
    });
    const mergedPylons = safeMergeAndDispose(pylonGeos);
    if (mergedPylons) {
      const pylonMesh = new THREE.Mesh(mergedPylons, this.carbonMaterial);
      pylonMesh.castShadow = true;
      frontWingGroup.add(pylonMesh);
    }

    // Dual FIA Teardrop Camera Pods on Nose Flanks (Batched)
    const camPodGeos: THREE.BufferGeometry[] = [];
    [-0.17, 0.17].forEach((camX) => {
      const camPodGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.12, 10);
      camPodGeo.rotateX(Math.PI / 2);
      camPodGeo.translate(camX, 0.38, 2.02);
      camPodGeos.push(camPodGeo);
    });
    const mergedCamPods = safeMergeAndDispose(camPodGeos);
    if (mergedCamPods) {
      const camPodMesh = new THREE.Mesh(mergedCamPods, this.carbonGlossMaterial);
      frontWingGroup.add(camPodMesh);
    }

    carBodyGroup.add(frontWingGroup);

    // =========================================================================
    // 7. ADVANCED 2026 GROUND-EFFECT REAR WING & ARTICULATED DRS SYSTEM
    // =========================================================================
    this.wingGroup = new THREE.Group();

    // 7.1 Sculpted High-Downforce Spoon-Camber Main Aerofoil
    // Deep parabolic scoop in center (-52mm dip) for extreme diffuser interaction,
    // curving up smoothly to outer tips to feed outwash vortex flow
    const rwMainGeo = new THREE.BoxGeometry(1.52, 0.036, 0.40, 32, 1, 8);
    const rwMainPos = rwMainGeo.attributes.position;
    for (let i = 0; i < rwMainPos.count; i++) {
      const x = rwMainPos.getX(i);
      const z = rwMainPos.getZ(i);
      const normX = Math.abs(x) / 0.76;

      // Central spoon dip: deep low-pressure suction channel
      const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.052;

      // True aerofoil camber with bullnose leading edge and tapered trailing lip
      const chordNorm = (z + 0.20) / 0.40;
      const aerofoilCamber = Math.sin(chordNorm * Math.PI) * 0.022;

      // Upward sweep at outer endplate junctions (fillet transition)
      const tipRise = Math.pow(normX, 2.5) * 0.034;

      rwMainPos.setY(i, rwMainPos.getY(i) + spoonDip + aerofoilCamber + tipRise);
    }
    rwMainGeo.computeVertexNormals();
    const rwMainMesh = new THREE.Mesh(rwMainGeo, this.bodyMaterial);
    rwMainMesh.position.set(0, 0.76, -1.80);
    rwMainMesh.rotation.x = 0.14;
    rwMainMesh.castShadow = true;
    this.wingGroup.add(rwMainMesh);

    // 7.1.1 FIA Carbon Slot-Gap Separators with Elastomeric Bump Stops (Batched)
    const sepGeos: THREE.BufferGeometry[] = [];
    const stopGeos: THREE.BufferGeometry[] = [];
    [-0.34, 0.34].forEach((sepX) => {
      const sepGeo = new THREE.BoxGeometry(0.008, 0.08, 0.16);
      sepGeo.rotateX(0.14);
      sepGeo.translate(sepX, 0.81, -1.78);
      sepGeos.push(sepGeo);

      // Molded elastomeric resting bump stop
      const stopGeo = new THREE.BoxGeometry(0.014, 0.010, 0.022);
      stopGeo.rotateX(0.14);
      stopGeo.translate(sepX, 0.846, -1.74);
      stopGeos.push(stopGeo);
    });
    const mergedSeps = safeMergeAndDispose(sepGeos);
    if (mergedSeps) {
      const sepMesh = new THREE.Mesh(mergedSeps, this.carbonGlossMaterial);
      this.wingGroup.add(sepMesh);
    }
    const mergedStops = safeMergeAndDispose(stopGeos);
    if (mergedStops) {
      const stopMesh = new THREE.Mesh(mergedStops, this.carbonMaterial);
      this.wingGroup.add(stopMesh);
    }

    // 7.2 Articulated Upper DRS Flap Assembly (Pivots smoothly on rear hinge)
    this.drsPivotGroup = new THREE.Group();
    // Base pivot axis in closed position (Z = -1.86, Y = 0.88)
    this.drsPivotGroup.position.set(0, 0.88, -1.86);

    // Upper DRS Aerofoil Blade extending FORWARD from the hinge (+Z)
    const drsFlapGeo = new THREE.BoxGeometry(1.48, 0.024, 0.22, 32, 1, 8);
    const drsFlapPos = drsFlapGeo.attributes.position;
    for (let i = 0; i < drsFlapPos.count; i++) {
      const x = drsFlapPos.getX(i);
      const z = drsFlapPos.getZ(i);
      const normX = Math.abs(x) / 0.74;
      const spoonDip = (1.0 - Math.min(1.0, Math.pow(normX, 1.8))) * -0.036;
      const tipRise = Math.pow(normX, 2.5) * 0.024;
      const chordNorm = (z + 0.11) / 0.22;
      const camber = Math.sin(chordNorm * Math.PI) * 0.014;
      drsFlapPos.setY(i, drsFlapPos.getY(i) + spoonDip + tipRise + camber);
    }
    drsFlapGeo.computeVertexNormals();
    const drsFlapMesh = new THREE.Mesh(drsFlapGeo, this.carbonMaterial);
    // Extends forward from hinge: center at Z = +0.11
    drsFlapMesh.position.set(0, 0.0, 0.11);
    drsFlapMesh.castShadow = true;
    this.drsPivotGroup.add(drsFlapMesh);

    // High Impact Rear Wing DRS Banner Decal (Mounted on the trailing face of the flap)
    // 2048x256 aspect ratio perfectly matches 1.46m x 0.18m geometry with zero distortion
    const drsBannerGeo = new THREE.PlaneGeometry(1.46, 0.18);
    const drsBannerMesh = new THREE.Mesh(drsBannerGeo, this.rearWingMaterial);
    drsBannerMesh.position.set(0, 0.0, -0.002);
    drsBannerMesh.rotation.y = Math.PI; // Face directly backward toward chase camera
    this.drsPivotGroup.add(drsBannerMesh);

    // Top Face Aerodynamic Carbon Surface (facing overhead, helicopter & cockpit cameras)
    const drsTopPlateGeo = new THREE.PlaneGeometry(1.46, 0.21);
    drsTopPlateGeo.rotateX(-Math.PI / 2);
    const drsTopPlateMesh = new THREE.Mesh(drsTopPlateGeo, this.carbonGlossMaterial);
    drsTopPlateMesh.position.set(0, 0.013, 0.11);
    this.drsPivotGroup.add(drsTopPlateMesh);

    // Carbon Gurney flap lip on DRS flap trailing edge (Wickerbill for localized downforce)
    const drsGurney = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.014, 0.006), this.carbonGlossMaterial);
    drsGurney.position.set(0, 0.016, 0.001);
    this.drsPivotGroup.add(drsGurney);

    // Underside Carbon Stiffening Stringers (3 structural ribs revealed when DRS is OPEN)
    [-0.42, 0, 0.42].forEach((rx) => {
      const ribGeo = new THREE.BoxGeometry(0.010, 0.018, 0.20);
      const ribMesh = new THREE.Mesh(ribGeo, this.carbonGlossMaterial);
      ribMesh.position.set(rx, -0.019, 0.11);
      this.drsPivotGroup.add(ribMesh);
    });

    // Central Titanium DRS Actuator Pickup Clevis Lug (underside of flap)
    const clevisGeo = new THREE.BoxGeometry(0.032, 0.038, 0.045);
    const clevisMesh = new THREE.Mesh(clevisGeo, this.mechanicalMetalMat);
    clevisMesh.position.set(0, -0.020, 0.04);
    this.drsPivotGroup.add(clevisMesh);

    // Twin Elastomeric Landing Pads (aligning with slot-gap separators)
    [-0.34, 0.34].forEach((px) => {
      const padGeo = new THREE.BoxGeometry(0.018, 0.008, 0.035);
      const padMesh = new THREE.Mesh(padGeo, this.carbonMaterial);
      padMesh.position.set(px, -0.019, 0.19);
      this.drsPivotGroup.add(padMesh);
    });

    // Initial closed rotation angle (0.12 rad: tightly closed high-downforce position)
    this.drsPivotGroup.rotation.x = this.currentDrsAngle;
    this.wingGroup.add(this.drsPivotGroup);

    // 7.3 Central DRS Hydraulic Actuator Bullet Pod with Active Status LED & PointLight
    const drsPodGroup = new THREE.Group();
    drsPodGroup.position.set(0, 0.80, -1.78);

    const podBodyGeo = new THREE.CylinderGeometry(0.026, 0.034, 0.16, 14);
    podBodyGeo.rotateX(Math.PI / 2);
    const podBody = new THREE.Mesh(podBodyGeo, this.carbonGlossMaterial);
    drsPodGroup.add(podBody);

    const podNoseGeo = new THREE.SphereGeometry(0.026, 12, 8);
    podNoseGeo.scale(1, 1, 1.8);
    const podNose = new THREE.Mesh(podNoseGeo, this.carbonGlossMaterial);
    podNose.position.set(0, 0, 0.09);
    drsPodGroup.add(podNose);

    // Extending Polished Chrome Hydraulic Piston Rod linked to DRS Flap
    const pistonGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.10, 12);
    pistonGeo.rotateX(Math.PI / 2);
    this.drsPistonMesh = new THREE.Mesh(pistonGeo, this.mechanicalMetalMat);
    this.drsPistonMesh.position.set(0, 0.028, -0.04);
    drsPodGroup.add(this.drsPistonMesh);

    // Kinematic Rocker Bellcrank Arms (rotate in lockstep with the flap opening)
    const rockerGeo = new THREE.BoxGeometry(0.007, 0.065, 0.014);
    [-0.034, 0.034].forEach((rx, idx) => {
      const rockerArm = new THREE.Mesh(rockerGeo, this.carbonGlossMaterial);
      rockerArm.position.set(rx, 0.040, -0.05);
      rockerArm.rotation.x = 0.15;
      drsPodGroup.add(rockerArm);
      if (idx === 0) this.drsRockerArmLeft = rockerArm;
      else this.drsRockerArmRight = rockerArm;
    });

    // Flexible Stainless Braided Hydraulic Lines feeding from spine into pod
    [-0.018, 0.018].forEach((hx) => {
      const p1 = new THREE.Vector3(hx, -0.04, 0.14);
      const p2 = new THREE.Vector3(hx * 0.6, 0.01, 0.06);
      const hose = this.createRodMesh(p1, p2, 0.005, this.mechanicalMetalMat, 6);
      drsPodGroup.add(hose);
    });

    // Real-time Active DRS Status Indicator LED Lens (Glows Green when DRS is Open)
    const ledGeo = new THREE.BoxGeometry(0.044, 0.014, 0.05);
    this.drsLedMesh = new THREE.Mesh(ledGeo, this.drsLedMaterial);
    this.drsLedMesh.position.set(0, 0.034, 0.01);
    drsPodGroup.add(this.drsLedMesh);

    // Active DRS Emerald Glow PointLight (illuminates actuator and slot aperture)
    if (!this.isAi) {
      this.drsPointLight = new THREE.PointLight(0x10b981, 0, 1.8, 2.0);
      this.drsPointLight.position.set(0, 0.08, -0.06);
      drsPodGroup.add(this.drsPointLight);
    }

    this.wingGroup.add(drsPodGroup);

    // 7.4 Lower Double Beam Wing (Diffuser Suction Assist Cascades)
    const beamWing1 = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.016, 0.22), this.carbonMaterial);
    beamWing1.position.set(0, 0.38, -1.72);
    beamWing1.rotation.x = 0.26;
    beamWing1.castShadow = true;
    this.wingGroup.add(beamWing1);

    const beamWing2 = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.014, 0.18), this.carbonMaterial);
    beamWing2.position.set(0, 0.45, -1.67);
    beamWing2.rotation.x = 0.20;
    beamWing2.castShadow = true;
    this.wingGroup.add(beamWing2);

    // 7.5 Modern 2026 Continuous Sweeping Curved Endplates (No 90° corners!)
    [-0.76, 0.76].forEach((sideX) => {
      const isRight = sideX > 0;
      const rwEndplateGroup = new THREE.Group();
      const endplateShape = new THREE.Shape();
      endplateShape.moveTo(-0.28, 0.44); // lower leading edge above beam wing
      endplateShape.lineTo(0.28, 0.44);  // lower trailing edge
      endplateShape.lineTo(0.26, 1.16);  // upper trailing edge
      endplateShape.quadraticCurveTo(0.18, 1.22, 0.02, 1.20); // curved upper tip
      endplateShape.lineTo(-0.26, 1.14); // upper leading edge
      endplateShape.quadraticCurveTo(-0.32, 0.72, -0.28, 0.44); // smooth curved forward scoop
      endplateShape.closePath();

      const rwEndplateGeo = new THREE.ExtrudeGeometry(endplateShape, {
        depth: 0.018,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.003,
        bevelSegments: 2,
      });
      rwEndplateGeo.rotateY(Math.PI / 2);

      // Generate clean planar UVs so both inner and outer faces are matte dark navy carbon with Red Bull decals
      const epPos = rwEndplateGeo.attributes.position;
      const epUvs = rwEndplateGeo.attributes.uv;
      for (let i = 0; i < epPos.count; i++) {
        const z = epPos.getZ(i);
        const y = epPos.getY(i);
        const u = THREE.MathUtils.clamp((z + 0.32) / 0.64, 0, 1);
        const v = THREE.MathUtils.clamp((y - 0.40) / 0.82, 0, 1);
        epUvs.setXY(i, u, v);
      }
      epUvs.needsUpdate = true;

      const rwEndplate = new THREE.Mesh(rwEndplateGeo, this.endplateDecalMaterial);
      rwEndplate.position.set(sideX, 0, -1.82);
      rwEndplate.castShadow = true;
      rwEndplateGroup.add(rwEndplate);

      // Titanium DRS Hinge Fairing Blister & Pivot Pin
      const blisterGeo = new THREE.CylinderGeometry(0.016, 0.020, 0.026, 12);
      blisterGeo.rotateZ(Math.PI / 2);
      const blisterMesh = new THREE.Mesh(blisterGeo, this.carbonGlossMaterial);
      blisterMesh.position.set(sideX + (isRight ? 0.012 : -0.012), 0.985, -1.86);
      rwEndplateGroup.add(blisterMesh);

      const pinGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.034, 10);
      pinGeo.rotateZ(Math.PI / 2);
      const pinMesh = new THREE.Mesh(pinGeo, this.mechanicalMetalMat);
      pinMesh.position.set(sideX + (isRight ? 0.014 : -0.014), 0.985, -1.86);
      rwEndplateGroup.add(pinMesh);

      // Inner Face Aerodynamic Guide Strakes (Carbon Gloss)
      const innerX = sideX + (isRight ? -0.012 : 0.012);
      [0.68, 0.82].forEach((sy) => {
        const strake = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.36), this.carbonGlossMaterial);
        strake.position.set(innerX, sy, -1.82);
        strake.rotation.x = -0.14;
        rwEndplateGroup.add(strake);
      });

      // Aerodynamic Corner Vortex Generators
      for (let v = 0; v < 3; v++) {
        const vGenGeo = new THREE.BoxGeometry(0.012, 0.012, 0.07);
        const vGen = new THREE.Mesh(vGenGeo, this.carbonGlossMaterial);
        vGen.position.set(sideX + (isRight ? 0.012 : -0.012), 0.92 + v * 0.045, -1.66);
        vGen.rotation.x = 0.42;
        rwEndplateGroup.add(vGen);
      }

      if (isRight) {
        this.rwEndplateRight = rwEndplateGroup;
      } else {
        this.rwEndplateLeft = rwEndplateGroup;
      }
      this.wingGroup.add(rwEndplateGroup);
    });

    // 7.6 Dual Overhead Swan-Neck Pylons with Titanium Clamps
    [-0.15, 0.15].forEach((pylonX) => {
      const isRight = pylonX > 0;
      const sw1 = new THREE.Vector3(pylonX, 0.42, -1.45);
      const sw2 = new THREE.Vector3(pylonX, 0.76, -1.66);
      const sw3 = new THREE.Vector3(pylonX, 0.98, -1.78);
      const sw4 = new THREE.Vector3(pylonX, 0.94, -1.86);
      const seg1 = this.createRodGeometry(sw1, sw2, 0.014, 8);
      const seg2 = this.createRodGeometry(sw2, sw3, 0.014, 8);
      const seg3 = this.createRodGeometry(sw3, sw4, 0.014, 8);
      const pylonGeos = [seg1, seg2, seg3].filter((g): g is THREE.BufferGeometry => g !== null);
      const mergedPylon = safeMergeAndDispose(pylonGeos);

      if (mergedPylon) {
        const pylonMesh = new THREE.Mesh(mergedPylon, this.carbonMaterial);
        pylonMesh.castShadow = true;
        pylonMesh.matrixAutoUpdate = false;
        pylonMesh.updateMatrix();
        if (isRight) {
          this.rwPylonRight = pylonMesh;
        } else {
          this.rwPylonLeft = pylonMesh;
        }
        this.wingGroup.add(pylonMesh);
      }
    });
    carBodyGroup.add(this.wingGroup);

    // =========================================================================
    // 8. EXPOSED CARBON DOUBLE-WISHBONE SUSPENSION (Airfoil Profiles) - Merged Batches
    // =========================================================================
    const suspensionGroup = new THREE.Group();
    const carbonWishboneGeos: THREE.BufferGeometry[] = [];
    const metalWishboneGeos: THREE.BufferGeometry[] = [];

    // Front Wishbones & Tie-Rods
    const frontAxleZ = 1.35;
    [-1, 1].forEach((side) => {
      const hubX = side * 0.88;
      const chassX = side * 0.22;

      const uFwdStart = new THREE.Vector3(chassX, 0.42, frontAxleZ + 0.16);
      const uFwdEnd = new THREE.Vector3(hubX, 0.36, frontAxleZ);
      const uAftStart = new THREE.Vector3(chassX, 0.42, frontAxleZ - 0.16);
      const uAftEnd = new THREE.Vector3(hubX, 0.36, frontAxleZ);
      const g1 = this.createRodGeometry(uFwdStart, uFwdEnd, 0.012, 6);
      const g2 = this.createRodGeometry(uAftStart, uAftEnd, 0.012, 6);
      if (g1) carbonWishboneGeos.push(g1);
      if (g2) carbonWishboneGeos.push(g2);

      const lFwdStart = new THREE.Vector3(chassX, 0.18, frontAxleZ + 0.18);
      const lFwdEnd = new THREE.Vector3(hubX, 0.20, frontAxleZ);
      const lAftStart = new THREE.Vector3(chassX, 0.18, frontAxleZ - 0.18);
      const lAftEnd = new THREE.Vector3(hubX, 0.20, frontAxleZ);
      const g3 = this.createRodGeometry(lFwdStart, lFwdEnd, 0.014, 6);
      const g4 = this.createRodGeometry(lAftStart, lAftEnd, 0.014, 6);
      if (g3) carbonWishboneGeos.push(g3);
      if (g4) carbonWishboneGeos.push(g4);

      const pushrodStart = new THREE.Vector3(hubX, 0.22, frontAxleZ);
      const pushrodEnd = new THREE.Vector3(chassX * 0.7, 0.46, frontAxleZ + 0.06);
      const g5 = this.createRodGeometry(pushrodStart, pushrodEnd, 0.011, 6);
      if (g5) metalWishboneGeos.push(g5);

      const tieRodStart = new THREE.Vector3(chassX * 0.9, 0.26, frontAxleZ - 0.12);
      const tieRodEnd = new THREE.Vector3(hubX * 0.96, 0.26, frontAxleZ - 0.08);
      const g6 = this.createRodGeometry(tieRodStart, tieRodEnd, 0.010, 6);
      if (g6) metalWishboneGeos.push(g6);
    });

    // Rear Wishbones & Driveshafts
    const rearAxleZ = -1.35;
    [-1, 1].forEach((side) => {
      const hubX = side * 0.92;
      const chassX = side * 0.26;

      const uFwdStart = new THREE.Vector3(chassX, 0.44, rearAxleZ + 0.18);
      const uFwdEnd = new THREE.Vector3(hubX, 0.38, rearAxleZ);
      const uAftStart = new THREE.Vector3(chassX, 0.44, rearAxleZ - 0.18);
      const uAftEnd = new THREE.Vector3(hubX, 0.38, rearAxleZ);
      const g1 = this.createRodGeometry(uFwdStart, uFwdEnd, 0.013, 6);
      const g2 = this.createRodGeometry(uAftStart, uAftEnd, 0.013, 6);
      if (g1) carbonWishboneGeos.push(g1);
      if (g2) carbonWishboneGeos.push(g2);

      const lFwdStart = new THREE.Vector3(chassX, 0.18, rearAxleZ + 0.20);
      const lFwdEnd = new THREE.Vector3(hubX, 0.20, rearAxleZ);
      const lAftStart = new THREE.Vector3(chassX, 0.18, rearAxleZ - 0.20);
      const lAftEnd = new THREE.Vector3(hubX, 0.20, rearAxleZ);
      const g3 = this.createRodGeometry(lFwdStart, lFwdEnd, 0.015, 6);
      const g4 = this.createRodGeometry(lAftStart, lAftEnd, 0.015, 6);
      if (g3) carbonWishboneGeos.push(g3);
      if (g4) carbonWishboneGeos.push(g4);

      const driveShaftStart = new THREE.Vector3(chassX * 0.8, 0.28, rearAxleZ);
      const driveShaftEnd = new THREE.Vector3(hubX * 0.95, 0.28, rearAxleZ);
      const g5 = this.createRodGeometry(driveShaftStart, driveShaftEnd, 0.018, 8);
      if (g5) metalWishboneGeos.push(g5);
    });

    const mergedCarbonWishbones = safeMergeAndDispose(carbonWishboneGeos);
    if (mergedCarbonWishbones) {
      const carbonMesh = new THREE.Mesh(mergedCarbonWishbones, this.carbonMaterial);
      carbonMesh.matrixAutoUpdate = false;
      carbonMesh.updateMatrix();
      suspensionGroup.add(carbonMesh);
    }

    const mergedMetalWishbones = safeMergeAndDispose(metalWishboneGeos);
    if (mergedMetalWishbones) {
      const metalMesh = new THREE.Mesh(mergedMetalWishbones, this.mechanicalMetalMat);
      metalMesh.matrixAutoUpdate = false;
      metalMesh.updateMatrix();
      suspensionGroup.add(metalMesh);
    }

    carBodyGroup.add(suspensionGroup);

    // =========================================================================
    // 9. RACING COCKPIT, F1 BUTTERFLY STEERING WHEEL & DRIVER
    // =========================================================================
    this.steeringWheelPivot = new THREE.Group();
    this.steeringWheelPivot.position.set(0, 0.46, 0.28);
    this.steeringWheel = new THREE.Group();

    // Central Carbon Hub
    const hubMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.024), this.carbonMaterial);
    this.steeringWheel.add(hubMesh);

    // Ergonomic Butterfly Alcantara Grips & Racing Gloves
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
    [-0.082, 0.082].forEach((gripX) => {
      const isRight = gripX > 0;
      const gripGeo = new THREE.CylinderGeometry(0.014, 0.016, 0.11, 10);
      gripGeo.rotateZ(isRight ? -0.12 : 0.12);
      const grip = new THREE.Mesh(gripGeo, gripMat);
      grip.position.set(gripX, 0, 0.005);
      this.steeringWheel.add(grip);

      // Nomex Racing Gloves with anatomical knuckles and palm grip
      const gloveGeo = new THREE.SphereGeometry(0.026, 12, 10);
      gloveGeo.scale(0.85, 1.35, 1.05);
      const gloveMat = new THREE.MeshStandardMaterial({
        color: this.liveryConfig.accentColor ? new THREE.Color(this.liveryConfig.accentColor) : new THREE.Color(0xdc2626),
        roughness: 0.70,
        metalness: 0.05,
      });
      const glove = new THREE.Mesh(gloveGeo, gloveMat);
      glove.position.set(gripX, 0.005, 0.012);
      this.steeringWheel.add(glove);
    });

    // Telemetry LCD Screen (High-Contrast Digital Motec Display)
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.038), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
    lcd.position.set(0, 0.005, 0.013);
    this.steeringWheel.add(lcd);

    // Shift Rev LEDs (Sequential Green -> Amber -> Red RPM indicators)
    this.revLedMeshes = [];
    for (let led = -3; led <= 3; led++) {
      const baseColor = Math.abs(led) <= 1 ? 0x22c55e : Math.abs(led) === 2 ? 0xeab308 : 0xef4444;
      const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), new THREE.MeshBasicMaterial({ color: baseColor }));
      ledMesh.position.set(led * 0.011, 0.032, 0.014);
      this.steeringWheel.add(ledMesh);
      this.revLedMeshes.push(ledMesh);
    }

    this.steeringWheelPivot.add(this.steeringWheel);
    carBodyGroup.add(this.steeringWheelPivot);

    // =========================================================================
    // DRIVER COCKPIT SEAT, NOMEX HARNESS & SCULPTED F1 AERODYNAMIC HELMET
    // =========================================================================
    // Driver Torso in Nomex Racing Suit with 6-point Sabelt Competition Harness
    const torsoGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.24, 16);
    torsoGeo.scale(1.15, 1.0, 0.75);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.88,
      metalness: 0.04,
    });
    const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    torsoMesh.position.set(0, 0.40, 0.02);
    carBodyGroup.add(torsoMesh);

    // Harness Straps (Red/Yellow contrasting competition shoulder belts - Batched)
    const beltGeos: THREE.BufferGeometry[] = [];
    [-0.055, 0.055].forEach((harnessX) => {
      const beltGeo = new THREE.BoxGeometry(0.026, 0.22, 0.008);
      beltGeo.rotateX(-0.15);
      beltGeo.translate(harnessX, 0.41, 0.08);
      beltGeos.push(beltGeo);
    });
    const mergedBelts = safeMergeAndDispose(beltGeos);
    if (mergedBelts) {
      const beltMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
      const beltMesh = new THREE.Mesh(mergedBelts, beltMat);
      carBodyGroup.add(beltMesh);
    }

    // Driver Helmet Assembly with G-Force Inertial Head Movement
    this.driverHelmet = new THREE.Group();
    this.driverHelmet.position.set(0, 0.58, 0.04);

    // 1. Aerodynamic Teardrop Helmet Shell with Gloss Clearcoat Automotive Finish (Batched Cranium & Chin)
    const helmetColor = this.liveryConfig.accentColor
      ? new THREE.Color(this.liveryConfig.accentColor)
      : new THREE.Color(0xf1f5f9);
    this.helmetShellMat = new THREE.MeshPhysicalMaterial({
      color: helmetColor,
      roughness: 0.16,
      metalness: 0.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.025,
      ior: 1.52,
      envMapIntensity: 1.4,
    });
    const helmetCraniumGeo = new THREE.SphereGeometry(0.126, 24, 20);
    helmetCraniumGeo.scale(0.92, 1.0, 1.10); // Sculpted aerodynamic racing profile

    const chinGeo = new THREE.CylinderGeometry(0.086, 0.106, 0.072, 18);
    chinGeo.scale(0.95, 1.0, 1.18);
    chinGeo.translate(0, -0.048, 0.042);

    const mergedHelmetShell = safeMergeAndDispose([helmetCraniumGeo, chinGeo]);
    if (mergedHelmetShell) {
      const helmetShellMesh = new THREE.Mesh(mergedHelmetShell, this.helmetShellMat);
      helmetShellMesh.castShadow = true;
      this.driverHelmet.add(helmetShellMesh);
    }

    // Chin Air Intake Scoop (Frontal airflow grille)
    const chinVentGeo = new THREE.BoxGeometry(0.045, 0.016, 0.012);
    const chinVent = new THREE.Mesh(chinVentGeo, new THREE.MeshBasicMaterial({ color: 0x09090b }));
    chinVent.position.set(0, -0.045, 0.138);
    this.driverHelmet.add(chinVent);

    // 3. Multilayer Chromatic Iridium Mirrored Visor (Reflects sky, track & Halo)
    this.helmetVisorMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      roughness: 0.025,
      metalness: 0.94,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      ior: 1.65,
      reflectivity: 0.96,
      envMapIntensity: 2.2,
    });
    // Curved visor following the eyeport arc
    const visorGeo = new THREE.CylinderGeometry(0.124, 0.124, 0.044, 20, 1, true, -Math.PI * 0.36, Math.PI * 0.72);
    const visorMesh = new THREE.Mesh(visorGeo, this.helmetVisorMat);
    visorMesh.rotation.y = Math.PI;
    visorMesh.position.set(0, 0.014, 0.022);
    this.driverHelmet.add(visorMesh);

    // Visor Sunstrip / Sponsor Banner Band
    const sunstripGeo = new THREE.CylinderGeometry(0.1245, 0.1245, 0.012, 20, 1, true, -Math.PI * 0.36, Math.PI * 0.72);
    const sunstripMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.45,
      metalness: 0.1,
    });
    const sunstripMesh = new THREE.Mesh(sunstripGeo, sunstripMat);
    sunstripMesh.rotation.y = Math.PI;
    sunstripMesh.position.set(0, 0.032, 0.022);
    this.driverHelmet.add(sunstripMesh);

    // 4. Rear Aerodynamic Gurney Flap / Nape Diffuser Crest (Translucent Smoked Polycarbonate)
    const napeSpoilerGeo = new THREE.BoxGeometry(0.11, 0.016, 0.055);
    const napeSpoilerMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.65,
      roughness: 0.12,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.5,
    });
    const napeSpoiler = new THREE.Mesh(napeSpoilerGeo, napeSpoilerMat);
    napeSpoiler.position.set(0, 0.035, -0.092);
    napeSpoiler.rotation.x = -0.38;
    this.driverHelmet.add(napeSpoiler);

    // 5. Technical Satin Carbon HANS Device Collar (Around driver's neck base)
    const hansGeo = new THREE.TorusGeometry(0.116, 0.022, 8, 18, Math.PI * 1.35);
    const hansMesh = new THREE.Mesh(hansGeo, this.carbonMaterial);
    hansMesh.rotation.x = Math.PI * 0.52;
    hansMesh.rotation.z = -Math.PI * 0.675;
    hansMesh.position.set(0, -0.075, -0.015);
    this.driverHelmet.add(hansMesh);

    carBodyGroup.add(this.driverHelmet);

    this.proceduralBodyGroup.add(carBodyGroup);
    this.group.add(this.proceduralBodyGroup);
    this.group.add(this.customModelGroup);
  }

  /**
   * Builds ultra-high detail competition wheels:
   * Rounded-shoulder slick tires, deep-dish concave forged rims, centerlock nuts,
   * perforated carbon-ceramic brake discs, and 6-piston yellow Brembo-style calipers.
   */
  private buildWheels(): void {
    const wheelPositions = [
      { x: -0.92, y: 0.33, z: 1.35, isFront: true, isRight: false },
      { x: 0.92, y: 0.33, z: 1.35, isFront: true, isRight: true },
      { x: -0.96, y: 0.35, z: -1.35, isFront: false, isRight: false },
      { x: 0.96, y: 0.35, z: -1.35, isFront: false, isRight: true },
    ];

    this.wheelMeshes = [];
    this.wheelPivots = [];
    this.wheelPivotsFront = [];
    this.brakeDiscs = [];
    this.tireStripeMaterials = [];
    this.tireMeshList = [];
    this.centerlockNuts = [];
    this.spokeMeshes = [];
    this.spokeMaterials = [];
    this.wheelBlurMeshes = [];
    this.wheelBlurMaterials = [];

    const treadNormal = CarModel.getTreadNormalTexture();

    wheelPositions.forEach((wp) => {
      const pivot = new THREE.Group();
      pivot.position.set(wp.x, wp.y, wp.z);
      pivot.userData = { baseY: wp.y };

      const wheelRotGroup = new THREE.Group();

      const tireRadius = wp.isFront ? 0.33 : 0.35;
      const tireWidth = wp.isFront ? 0.30 : 0.38;

      // 1. ROUNDED-SHOULDER COMPETITION SLICK TIRE WITH PBR TREAD NORMAL MAP
      const tireSegments = 28;
      const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, tireSegments, 6, false);
      tireGeo.rotateZ(Math.PI / 2);
      const tirePos = tireGeo.attributes.position;
      for (let i = 0; i < tirePos.count; i++) {
        const x = tirePos.getX(i);
        const normX = Math.min(1.0, Math.abs(x) / (tireWidth / 2));
        if (normX > 0.65) {
          const shoulderProgress = Math.min(1.0, Math.max(0.0, (normX - 0.65) / 0.35));
          const shoulderRound = Math.pow(shoulderProgress, 2.0) * 0.022;
          const y = tirePos.getY(i);
          const z = tirePos.getZ(i);
          const r = Math.sqrt(y * y + z * z);
          if (r > 0.05 && Number.isFinite(r)) {
            const newR = Math.max(0.01, r - shoulderRound);
            const scale = newR / r;
            if (Number.isFinite(scale)) {
              tirePos.setY(i, y * scale);
              tirePos.setZ(i, z * scale);
            }
          }
        }
      }
      tireGeo.computeVertexNormals();

      const tireMat = new THREE.MeshStandardMaterial({
        color: 0x141519,
        roughness: 0.74,
        metalness: 0.0,
        normalMap: treadNormal,
        normalScale: new THREE.Vector2(0.40, 0.40),
        envMapIntensity: 0.38,
      });
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.castShadow = true;
      tireMesh.receiveShadow = true;
      wheelRotGroup.add(tireMesh);
      this.tireMeshList.push(tireMesh);

      // 2. Pirelli P-Zero Competition Sidewall Identification Ring & Stencil
      const sidewallTex = this.createTireSidewallTexture(this.currentTireCompoundColor);
      const pzeroGeo = new THREE.RingGeometry(tireRadius * 0.62, tireRadius * 0.98, 32);
      pzeroGeo.rotateY(wp.isRight ? Math.PI / 2 : -Math.PI / 2);
      const pzeroMat = new THREE.MeshStandardMaterial({
        map: sidewallTex,
        roughness: 0.52,
        metalness: 0.02,
        envMapIntensity: 0.60,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0,
      });
      const pzeroRing = new THREE.Mesh(pzeroGeo, pzeroMat);
      pzeroRing.position.x = wp.isRight ? tireWidth / 2 + 0.004 : -tireWidth / 2 - 0.004;
      wheelRotGroup.add(pzeroRing);
      this.tireStripeMaterials.push(pzeroMat);

      // 3. BBS FORGED DEEP-DISH CONCAVE RACING RIM
      const rimRadius = tireRadius * 0.64;
      const rimGroup = new THREE.Group();

      const barrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, tireWidth * 0.92, 20, 1, true);
      barrelGeo.rotateZ(Math.PI / 2);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x181a20,
        metalness: 0.92,
        roughness: 0.26,
        envMapIntensity: 1.40,
      });
      const barrel = new THREE.Mesh(barrelGeo, rimMat);
      rimGroup.add(barrel);

      // 10 Sculpted Deep-Dish Concave Forged Spokes (with dynamic motion fade)
      const spokeCount = 10;
      const spokeGeos: THREE.BufferGeometry[] = [];
      for (let s = 0; s < spokeCount; s++) {
        const angle = (s / spokeCount) * Math.PI * 2;
        const hubPoint = new THREE.Vector3(
          wp.isRight ? tireWidth * 0.36 : -tireWidth * 0.36,
          0,
          0
        );
        const rimPoint = new THREE.Vector3(
          wp.isRight ? tireWidth * 0.48 : -tireWidth * 0.48,
          Math.sin(angle) * (rimRadius * 0.96),
          Math.cos(angle) * (rimRadius * 0.96)
        );
        const sGeo = this.createRodGeometry(hubPoint, rimPoint, 0.012, 6, 0.016);
        if (sGeo) spokeGeos.push(sGeo);
      }
      const mergedSpokes = safeMergeAndDispose(spokeGeos);
      const spokeMat = new THREE.MeshStandardMaterial({
        color: 0x181a20,
        metalness: 0.92,
        roughness: 0.26,
        envMapIntensity: 1.40,
        transparent: true,
        opacity: 1.0,
      });
      if (mergedSpokes) {
        const spokeMesh = new THREE.Mesh(mergedSpokes, spokeMat);
        rimGroup.add(spokeMesh);
        this.spokeMeshes.push(spokeMesh);
        this.spokeMaterials.push(spokeMat);
      }
      wheelRotGroup.add(rimGroup);

      // 4. High-Speed Radial Motion Blur Disk (eliminates wagon wheel temporal aliasing)
      const blurTex = this.createWheelRadialBlurTexture(this.currentTireCompoundColor);
      const blurGeo = new THREE.RingGeometry(rimRadius * 0.20, tireRadius * 0.985, 36);
      blurGeo.rotateY(wp.isRight ? Math.PI / 2 : -Math.PI / 2);
      const blurMat = new THREE.MeshStandardMaterial({
        map: blurTex,
        roughness: 0.26,
        metalness: 0.88,
        envMapIntensity: 1.25,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const blurMesh = new THREE.Mesh(blurGeo, blurMat);
      blurMesh.position.x = wp.isRight ? tireWidth / 2 + 0.006 : -tireWidth / 2 - 0.006;
      blurMesh.visible = false;
      wheelRotGroup.add(blurMesh);
      this.wheelBlurMeshes.push(blurMesh);
      this.wheelBlurMaterials.push(blurMat);

      // 5. Anodized Centerlock Wheel Nut (Blue on Right, Red on Left)
      const nutGeo = new THREE.CylinderGeometry(0.045, 0.055, tireWidth + 0.025, 8);
      nutGeo.rotateZ(Math.PI / 2);
      const nutMat = new THREE.MeshStandardMaterial({
        color: wp.isRight ? 0x0284c7 : 0xcc0022,
        metalness: 0.95,
        roughness: 0.16,
      });
      const nut = new THREE.Mesh(nutGeo, nutMat);
      wheelRotGroup.add(nut);
      this.centerlockNuts.push(nut);

      // 6. Perforated Carbon-Ceramic Brake Disc (Shared Material)
      const discRadius = rimRadius * 0.82;
      const discGeo = new THREE.CylinderGeometry(discRadius, discRadius, 0.028, 20);
      discGeo.rotateZ(Math.PI / 2);
      const disc = new THREE.Mesh(discGeo, this.brakeDiscMaterial);
      this.brakeDiscs.push(disc);
      pivot.add(disc);

      // 7. Brembo 6-Piston Caliper (Fluorescent Race Yellow)
      const caliperGeo = new THREE.BoxGeometry(0.075, 0.14, 0.20);
      const caliperMat = new THREE.MeshStandardMaterial({
        color: 0xeab308,
        roughness: 0.24,
        metalness: 0.55,
      });
      const caliper = new THREE.Mesh(caliperGeo, caliperMat);
      caliper.position.set(wp.isRight ? -0.05 : 0.05, 0.06, 0.06);
      pivot.add(caliper);

      // 8. Titanium Axle Spindle
      const spindleGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10);
      spindleGeo.rotateZ(Math.PI / 2);
      const spindle = new THREE.Mesh(spindleGeo, this.mechanicalMetalMat);
      spindle.position.set(wp.isRight ? 0.04 : -0.04, 0, 0);
      pivot.add(spindle);

      pivot.add(wheelRotGroup);
      this.proceduralBodyGroup.add(pivot);

      this.wheelMeshes.push(wheelRotGroup);
      this.wheelPivots.push(pivot);
      if (wp.isFront) {
        this.wheelPivotsFront.push(pivot);
      }
    });
  }

  /**
   * Builds dynamic headlights and FIA rain light
   */
  private buildLights(): void {
    const rainLightGeo = new THREE.BoxGeometry(0.08, 0.05, 0.03);
    const rainLightMesh = new THREE.Mesh(rainLightGeo, this.fiaRainLight);
    rainLightMesh.position.set(0, 0.22, -1.94);
    this.proceduralBodyGroup.add(rainLightMesh);

    [-0.18, 0.18].forEach((sideX) => {
      const ledGeo = new THREE.BoxGeometry(0.06, 0.016, 0.18);
      const ledMesh = new THREE.Mesh(ledGeo, this.headlightGlowMat);
      ledMesh.position.set(sideX, 0.36, 1.35);
      ledMesh.rotation.y = sideX > 0 ? -0.15 : 0.15;
      this.proceduralBodyGroup.add(ledMesh);
    });
  }

  /**
   * Builds dual titanium/inconel exhaust tips and dynamic backfire flames
   */
  private buildExhausts(): void {
    const exhaustPositions = [
      { x: -0.065, y: 0.44, z: -1.48 },
      { x: 0.065, y: 0.44, z: -1.48 },
    ];

    this.exhaustTips = [];
    this.exhaustFlameMaterials = [];
    this.exhaustFlameMeshes = [];

    exhaustPositions.forEach((pos) => {
      const tipGroup = new THREE.Group();
      tipGroup.position.set(pos.x, pos.y, pos.z);

      const pipeGeo = new THREE.CylinderGeometry(0.038, 0.042, 0.16, 14, 1, true);
      pipeGeo.rotateX(Math.PI / 2);
      const pipeMesh = new THREE.Mesh(pipeGeo, this.exhaustGlowMat);
      tipGroup.add(pipeMesh);

      const flameGeo = new THREE.ConeGeometry(0.055, 0.38, 10, 4, true);
      flameGeo.rotateX(-Math.PI / 2);
      flameGeo.translate(0, 0, -0.19);

      const flameMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uColorCore: { value: new THREE.Color(0x60a5fa) },
          uColorOuter: { value: new THREE.Color(0xf97316) },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          void main() {
            vUv = uv;
            vNormal = normal;
            vec3 pos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uIntensity;
          uniform vec3 uColorCore;
          uniform vec3 uColorOuter;
          varying vec2 vUv;
          void main() {
            if (uIntensity < 0.01) discard;
            float pulse = sin(uTime * 45.0 + vUv.y * 12.0) * 0.15 + 0.85;
            float alpha = (1.0 - vUv.y) * uIntensity * pulse;
            vec3 col = mix(uColorCore, uColorOuter, smoothstep(0.2, 0.9, vUv.y));
            gl_FragColor = vec4(col * 2.5, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const flameMesh = new THREE.Mesh(flameGeo, flameMat);
      flameMesh.visible = false;
      tipGroup.add(flameMesh);

      this.exhaustFlameMaterials.push(flameMat);
      this.exhaustFlameMeshes.push(flameMesh);
      this.exhaustTips.push(tipGroup);
      this.proceduralBodyGroup.add(tipGroup);
    });

    if (!this.isAi) {
      this.exhaustPointLight = new THREE.PointLight(0xff6600, 0, 6, 2);
      this.exhaustPointLight.position.set(0, 0.44, -1.65);
      this.proceduralBodyGroup.add(this.exhaustPointLight);
    }
  }

  /**
   * Triggers realistic multi-phase exhaust backfire flame
   */
  public triggerBackfire(isHighRpm: boolean = false): void {
    this.backfireState.active = true;
    this.backfireState.phaseTime = 0;
    this.backfireState.isHighRpm = isHighRpm;
    this.backfireState.totalDuration = isHighRpm ? 0.22 : 0.16;

    this.exhaustFlameMeshes.forEach((m) => {
      m.visible = true;
    });
  }

  /**
   * Wheels & Pit Stop Operations
   */
  public setWheelOffset(wheelIdx: number, offset: number): void {
    if (this.wheelMeshes[wheelIdx]) {
      const isRight = wheelIdx === 1 || wheelIdx === 3;
      this.wheelMeshes[wheelIdx].position.x = offset * (isRight ? 1 : -1);
    }
  }

  public setWheelVisible(wheelIdx: number, visible: boolean): void {
    if (this.wheelMeshes[wheelIdx]) {
      this.wheelMeshes[wheelIdx].visible = visible;
    }
  }

  public setAllWheelsVisible(visible: boolean = true): void {
    for (let i = 0; i < 4; i++) {
      if (this.wheelMeshes[i]) {
        this.wheelMeshes[i].visible = visible;
      }
    }
  }

  public resetWheelOffsets(): void {
    for (let i = 0; i < 4; i++) {
      if (this.wheelMeshes[i]) {
        this.wheelMeshes[i].position.x = 0;
      }
    }
  }

  public setTireCompoundVisuals(compound: TireCompoundType): void {
    const config = TIRE_COMPOUNDS[compound] || TIRE_COMPOUNDS.soft;
    const colorHexStr = `#${config.stripeColorHex.toString(16).padStart(6, '0')}`;
    this.currentTireCompoundColor = colorHexStr;
    const newSidewallTex = this.createTireSidewallTexture(colorHexStr);
    const newBlurTex = this.createWheelRadialBlurTexture(colorHexStr);
    this.tireStripeMaterials.forEach((mat) => {
      mat.map = newSidewallTex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    });
    this.wheelBlurMaterials.forEach((mat) => {
      mat.map = newBlurTex;
      mat.needsUpdate = true;
    });
  }

  public setBrakeDiscThermalGlow(glowFactor: number): void {
    const f = Math.max(0, Math.min(1.0, glowFactor));
    this.brakeDiscs.forEach((disc) => {
      const mat = disc.material as THREE.MeshStandardMaterial;
      if (mat) {
        if (f > 0.01) {
          mat.emissive.setRGB(0.95 * f, 0.22 * f * f, 0.03 * f * f);
          mat.emissiveIntensity = f * 3.5;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    });
  }

  public setCenterlockNutSpin(wheelIdx: number, angle: number): void {
    if (this.centerlockNuts[wheelIdx]) {
      this.centerlockNuts[wheelIdx].rotation.x = angle;
    }
  }

  public getWheelHubWorldPos(wheelIdx: number, target: THREE.Vector3): THREE.Vector3 {
    if (this.wheelPivots[wheelIdx]) {
      this.wheelPivots[wheelIdx].getWorldPosition(target);
      return target;
    }
    if (this.wheelMeshes[wheelIdx]) {
      this.wheelMeshes[wheelIdx].getWorldPosition(target);
      return target;
    }
    return target.set(0, 0, 0);
  }

  public getFourWheelWorldPositions(
    wFL: THREE.Vector3,
    wFR: THREE.Vector3,
    wRL: THREE.Vector3,
    wRR: THREE.Vector3
  ): void {
    if (this.wheelPivots.length >= 4) {
      this.wheelPivots[0].getWorldPosition(wFL);
      this.wheelPivots[1].getWorldPosition(wFR);
      this.wheelPivots[2].getWorldPosition(wRL);
      this.wheelPivots[3].getWorldPosition(wRR);
    } else {
      const p = this.group.position;
      wFL.set(p.x - 0.92, p.y + 0.33, p.z + 1.35);
      wFR.set(p.x + 0.92, p.y + 0.33, p.z + 1.35);
      wRL.set(p.x - 0.96, p.y + 0.35, p.z - 1.35);
      wRR.set(p.x + 0.96, p.y + 0.35, p.z - 1.35);
    }
  }

  public getSingleWheelWorldPosition(wheelIdx: number, out: THREE.Vector3): void {
    if (this.wheelPivots.length > wheelIdx && this.wheelPivots[wheelIdx]) {
      this.wheelPivots[wheelIdx].getWorldPosition(out);
    } else {
      const p = this.group.position;
      const xSign = (wheelIdx % 2 === 0) ? -1 : 1;
      const zOffset = wheelIdx < 2 ? 1.35 : -1.35;
      out.set(p.x + xSign * 0.94, p.y + 0.34, p.z + zOffset);
    }
  }

  public getWingtipWorldPositions(
    leftTip: THREE.Vector3,
    rightTip: THREE.Vector3,
    rearDir: THREE.Vector3
  ): void {
    const p = this.group.position;
    const yaw = this.group.rotation.y;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    const wingLocalZ = -1.82;
    const wingLocalY = 0.92;
    const wingHalfW = 0.74;

    leftTip.set(
      p.x - cosY * wingHalfW + sinY * wingLocalZ,
      p.y + wingLocalY,
      p.z + sinY * wingHalfW + cosY * wingLocalZ
    );

    rightTip.set(
      p.x + cosY * wingHalfW + sinY * wingLocalZ,
      p.y + wingLocalY,
      p.z - sinY * wingHalfW + cosY * wingLocalZ
    );

    rearDir.set(-sinY, 0, -cosY);
  }

  /**
   * Calculates the exact world 3D coordinates and ground penetration of front wing scrape tips
   */
  public getFrontWingScrapeWorldPositions(
    leftOut: THREE.Vector3,
    rightOut: THREE.Vector3
  ): { leftScraping: boolean; rightScraping: boolean } {
    let leftScraping = false;
    let rightScraping = false;

    if (this.frontWingLeftGroup && this.frontWingLeftGroup.visible && this.frontWingLeftMainGroup?.visible) {
      this._scratchWingL.set(-0.95, 0.04, 2.24);
      this.frontWingLeftGroup.localToWorld(this._scratchWingL);
      leftOut.copy(this._scratchWingL);
      if (leftOut.y <= 0.045) {
        leftScraping = true;
        leftOut.y = Math.max(0.015, leftOut.y);
      }
    } else {
      leftOut.set(0, -999, 0);
    }

    if (this.frontWingRightGroup && this.frontWingRightGroup.visible && this.frontWingRightMainGroup?.visible) {
      this._scratchWingR.set(0.95, 0.04, 2.24);
      this.frontWingRightGroup.localToWorld(this._scratchWingR);
      rightOut.copy(this._scratchWingR);
      if (rightOut.y <= 0.045) {
        rightScraping = true;
        rightOut.y = Math.max(0.015, rightOut.y);
      }
    } else {
      rightOut.set(0, -999, 0);
    }

    return { leftScraping, rightScraping };
  }

  /**
   * Calculates the exact 3D world coordinates of the underbody titanium skid block assembly
   * located along the center keel beneath the cockpit and fuel cell.
   */
  public getUnderbodyPlankWorldPosition(outPos: THREE.Vector3, rearDir: THREE.Vector3): void {
    const p = this.group.position;
    const yaw = this.group.rotation.y;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    // Titanium plank keel center is at Z = -0.65, Y = 0.012
    outPos.set(
      p.x - sinY * 0.65,
      Math.max(0.008, p.y + 0.012),
      p.z - cosY * 0.65
    );
    rearDir.set(-sinY, 0, -cosY);
  }

  public getExhaustWorldPositions(
    leftPipe: THREE.Vector3,
    rightPipe: THREE.Vector3,
    rearDir: THREE.Vector3
  ): void {
    const p = this.group.position;
    const yaw = this.group.rotation.y;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    const pipeZ = -1.48;
    const pipeY = 0.44;
    const pipeDist = 0.065;

    leftPipe.set(
      p.x - cosY * pipeDist + sinY * pipeZ,
      p.y + pipeY,
      p.z + sinY * pipeDist + cosY * pipeZ
    );

    rightPipe.set(
      p.x + cosY * pipeDist + sinY * pipeZ,
      p.y + pipeY,
      p.z - sinY * pipeDist + cosY * pipeZ
    );

    rearDir.set(-sinY, 0, -cosY);
  }

  public getSpindleWorldTransform(
    wheelIdx: number,
    outPos: THREE.Vector3,
    outAxleDir: THREE.Vector3,
    outQuat: THREE.Quaternion
  ): void {
    if (this.wheelPivots[wheelIdx]) {
      this.wheelPivots[wheelIdx].getWorldPosition(outPos);
      this.wheelPivots[wheelIdx].getWorldQuaternion(outQuat);
      const isRight = wheelIdx === 1 || wheelIdx === 3;
      outAxleDir.set(isRight ? 1 : -1, 0, 0).applyQuaternion(outQuat).normalize();
    } else {
      outPos.set(0, 0, 0);
      outAxleDir.set(1, 0, 0);
      outQuat.identity();
    }
  }

  public repairWingVisuals(): void {
    this.frontWingLeftOsc = { roll: 0, pitch: 0, y: 0 };
    this.frontWingLeftVel = { roll: 0, pitch: 0, y: 0 };
    this.frontWingRightOsc = { roll: 0, pitch: 0, y: 0 };
    this.frontWingRightVel = { roll: 0, pitch: 0, y: 0 };
    if (this.frontWingLeftGroup) {
      this.frontWingLeftGroup.visible = true;
      this.frontWingLeftGroup.rotation.set(0, 0, 0);
      this.frontWingLeftGroup.position.set(0, 0, 0);
    }
    if (this.frontWingRightGroup) {
      this.frontWingRightGroup.visible = true;
      this.frontWingRightGroup.rotation.set(0, 0, 0);
      this.frontWingRightGroup.position.set(0, 0, 0);
    }
    if (this.frontWingLeftMainGroup) this.frontWingLeftMainGroup.visible = true;
    if (this.frontWingLeftUpperFlapGroup) this.frontWingLeftUpperFlapGroup.visible = true;
    if (this.endplateLeftGroup) this.endplateLeftGroup.visible = true;
    if (this.frontWingLeftStubMesh) this.frontWingLeftStubMesh.visible = false;
    if (this.frontWingRightMainGroup) this.frontWingRightMainGroup.visible = true;
    if (this.frontWingRightUpperFlapGroup) this.frontWingRightUpperFlapGroup.visible = true;
    if (this.endplateRightGroup) this.endplateRightGroup.visible = true;
    if (this.frontWingRightStubMesh) this.frontWingRightStubMesh.visible = false;
    if (this.wingGroup) this.wingGroup.visible = true;
    this.lastAppliedDamageHash = '';
  }

  /**
   * Main Per-Frame Dynamic Animation Update
   */
  public update(
    steerAngle: number,
    wheelRotations: number[],
    brake: number,
    speedKmh: number,
    damage: DamageState,
    isBackfiring: boolean,
    rpm: number = 1000,
    suspensionCompression?: number[],
    isPunctured?: boolean[],
    tireWear?: number[],
    dt: number = 0.016,
    throttle: number = 0
  ): void {
    // 1. Front Wheels Ackermann Steering Geometry
    if (this.wheelPivotsFront[0] && this.wheelPivotsFront[1]) {
      if (steerAngle > 0) {
        this.wheelPivotsFront[0].rotation.y = steerAngle * 1.08;
        this.wheelPivotsFront[1].rotation.y = steerAngle * 0.92;
      } else if (steerAngle < 0) {
        this.wheelPivotsFront[0].rotation.y = steerAngle * 0.92;
        this.wheelPivotsFront[1].rotation.y = steerAngle * 1.08;
      } else {
        this.wheelPivotsFront[0].rotation.y = 0;
        this.wheelPivotsFront[1].rotation.y = 0;
      }
    }

    // 2. Dynamic Suspension Travel, Wheel Rolling, Radial Motion Blur & Puncture Deflation
    const absSpeed = Math.abs(speedKmh);
    const blurTarget = THREE.MathUtils.clamp((absSpeed - 24.0) / 48.0, 0.0, 0.96);
    this.currentBlurOpacity += (blurTarget - this.currentBlurOpacity) * Math.min(1.0, 20.0 * dt);
    const blurOpacity = this.currentBlurOpacity;
    const spokeOpacity = THREE.MathUtils.clamp(1.0 - blurOpacity * 0.88, 0.0, 1.0);
    const sidewallOpacity = THREE.MathUtils.clamp(1.0 - blurOpacity * 0.82, 0.0, 1.0);
    const aeroDownforce = Math.min(1.6, Math.pow(absSpeed / 160.0, 2.0));

    for (let i = 0; i < 4; i++) {
      const punctured = Boolean(isPunctured && isPunctured[i]);
      const wear = (tireWear && tireWear[i] !== undefined) ? tireWear[i] : 0;

      if (this.wheelPivots[i] && this.wheelPivots[i].userData?.baseY !== undefined) {
        const targetComp = (suspensionCompression && suspensionCompression[i] !== undefined)
          ? suspensionCompression[i]
          : 0;

        this.currentWheelCompression[i] += (targetComp - this.currentWheelCompression[i]) * Math.min(1.0, 24.0 * dt);
        const comp = this.currentWheelCompression[i];

        const punctureDrop = punctured ? -0.075 : 0;
        this.wheelPivots[i].position.y = this.wheelPivots[i].userData.baseY + comp + punctureDrop;

        let brokenCamber = 0;
        if (i === 0) brokenCamber = damage.suspensionCamberFL || 0;
        else if (i === 1) brokenCamber = -(damage.suspensionCamberFR || 0);
        else if (i === 2) brokenCamber = damage.suspensionCamberRL || 0;
        else if (i === 3) brokenCamber = -(damage.suspensionCamberRR || 0);

        const brokenWobble = (brokenCamber !== 0 && absSpeed > 3.0)
          ? Math.sin(wheelRotations[i] * 2.0) * (Math.abs(brokenCamber) * 0.40)
          : 0;

        if (punctured && absSpeed > 2) {
          const flapFreq = wheelRotations[i] * 2.0;
          this.wheelPivots[i].rotation.z = (i % 2 === 0 ? -0.09 : 0.09) + Math.sin(flapFreq) * 0.04 + brokenCamber + brokenWobble;
        } else {
          this.wheelPivots[i].rotation.z = (punctured ? (i % 2 === 0 ? -0.08 : 0.08) : 0) + brokenCamber + brokenWobble;
        }

        if (i < 2 && this.wheelPivotsFront[i] && brokenCamber !== 0) {
          const brokenToe = (i === 0 ? -1 : 1) * Math.abs(brokenCamber) * 0.45;
          this.wheelPivotsFront[i].rotation.y += brokenToe;
        }
      }

      // Wheel Forward Roll & Dynamic Tire Contact Patch Squish (Vertical Deflection under Downforce)
      if (this.wheelMeshes[i]) {
        this.wheelMeshes[i].rotation.x = wheelRotations[i];

        if (punctured) {
          const flatPulse = 0.76 + Math.sin(wheelRotations[i] * 2.0) * 0.04;
          this.wheelMeshes[i].scale.set(1.06, flatPulse, 1.06);
        } else {
          const dynamicComp = (suspensionCompression && suspensionCompression[i] !== undefined) ? suspensionCompression[i] : 0;
          const squish = Math.min(0.024, (1.0 + aeroDownforce) * 0.005 + Math.max(0, -dynamicComp) * 0.12);
          this.wheelMeshes[i].scale.set(1.0 + squish * 0.32, 1.0 - squish * 0.50, 1.0 + squish * 0.20);
        }
      }

      // High-Velocity Radial Motion Blur & Spokes Cross-Fade
      if (this.spokeMaterials[i]) {
        this.spokeMaterials[i].opacity = spokeOpacity;
      }
      if (this.spokeMeshes[i]) {
        this.spokeMeshes[i].visible = spokeOpacity > 0.04;
      }
      if (this.tireStripeMaterials[i]) {
        this.tireStripeMaterials[i].opacity = sidewallOpacity;
      }
      if (this.wheelBlurMaterials[i]) {
        this.wheelBlurMaterials[i].opacity = blurOpacity;
      }
      if (this.wheelBlurMeshes[i]) {
        this.wheelBlurMeshes[i].visible = blurOpacity > 0.03;
      }

      // Thermodynamic Tire Temperature Evolution (Smooth organic heating and cooling)
      const targetTemp = punctured ? 0.0 : THREE.MathUtils.clamp((absSpeed / 95.0) * 0.70 + (brake > 0.20 ? 0.30 : 0.0), 0.0, 1.0);
      const tempRate = targetTemp > this.currentTireTemp[i] ? 1.8 : 0.7; // Responsive heating, progressive cooling
      this.currentTireTemp[i] += (targetTemp - this.currentTireTemp[i]) * Math.min(1.0, tempRate * dt);
      const thermalFactor = this.currentTireTemp[i];

      // Dynamic Rubber Thermal PBR & Wear with continuous smooth color/roughness interpolation
      if (this.tireMeshList[i]) {
        const mat = this.tireMeshList[i].material as THREE.MeshStandardMaterial;
        if (punctured) {
          const pRate = Math.min(1.0, 6.0 * dt);
          mat.roughness = THREE.MathUtils.lerp(mat.roughness, 0.96, pRate);
          mat.metalness = THREE.MathUtils.lerp(mat.metalness, 0.02, pRate);
          mat.color.r = THREE.MathUtils.lerp(mat.color.r, 0.018, pRate);
          mat.color.g = THREE.MathUtils.lerp(mat.color.g, 0.019, pRate);
          mat.color.b = THREE.MathUtils.lerp(mat.color.b, 0.022, pRate);
        } else {
          const wearFactor = THREE.MathUtils.clamp((wear - 45.0) / 50.0, 0.0, 1.0);
          
          // Authentic Motorsport Dark Rubber Gamut:
          // Cold resting rubber: #101114 (r=0.024, g=0.026, b=0.030) - deep satin matte black
          // Hot vulcanized racing rubber: #050608 (r=0.010, g=0.012, b=0.016) - intense pitch obsidian black with high specular gloss
          // Heavy wear: #1c1e24 (r=0.042, g=0.044, b=0.052) - subtly dusted/weathered dark rubber
          let targetR = THREE.MathUtils.lerp(0.024, 0.010, thermalFactor);
          let targetG = THREE.MathUtils.lerp(0.026, 0.012, thermalFactor);
          let targetB = THREE.MathUtils.lerp(0.030, 0.016, thermalFactor);
          
          if (wearFactor > 0.01) {
            targetR = THREE.MathUtils.lerp(targetR, 0.042, wearFactor);
            targetG = THREE.MathUtils.lerp(targetG, 0.044, wearFactor);
            targetB = THREE.MathUtils.lerp(targetB, 0.052, wearFactor);
          }

          // Cold = 0.65 roughness (satin matte), Hot = 0.22 roughness (glossy, reflective vulcanized sheen)
          const targetRoughness = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(0.65, 0.22, thermalFactor),
            0.88,
            wearFactor
          );
          // Cold = 0.06 metalness, Hot = 0.28 (crisp specular reflections catching sunlight)
          const targetMetalness = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(0.06, 0.28, thermalFactor),
            0.02,
            wearFactor
          );

          // Smooth frame-rate independent interpolation
          const lerpRate = Math.min(1.0, 5.0 * dt);
          mat.roughness += (targetRoughness - mat.roughness) * lerpRate;
          mat.metalness += (targetMetalness - mat.metalness) * lerpRate;
          mat.color.r += (targetR - mat.color.r) * lerpRate;
          mat.color.g += (targetG - mat.color.g) * lerpRate;
          mat.color.b += (targetB - mat.color.b) * lerpRate;
        }
      }
    }

    // 3. Thermodynamic Carbon-Ceramic Brake Disc Simulation with Convective Cooling Hysteresis
    const isBrakingHard = brake > 0.15 && speedKmh > 20;
    const targetBrakeHeat = isBrakingHard ? Math.min(1.0, (brake * speedKmh) / 105.0) : 0;
    if (targetBrakeHeat > this.currentBrakeTemp) {
      // Rapid thermal heating under kinetic friction (~0.25-0.35s to incandescent temperature)
      this.currentBrakeTemp += (targetBrakeHeat - this.currentBrakeTemp) * Math.min(1.0, 5.5 * dt);
    } else {
      // Aerodynamic convective cooling through carbon brake ducts and wheel spokes (~1.5s - 2.5s)
      const aeroCoolingRate = 0.45 + (speedKmh / 160.0) * 0.85;
      this.currentBrakeTemp = Math.max(0, this.currentBrakeTemp - this.currentBrakeTemp * Math.min(1.0, aeroCoolingRate * dt));
    }

    const brakeTemp = this.currentBrakeTemp;
    if (Math.abs(brakeTemp - this.lastBrakeIntensity) > 0.015 || (brakeTemp <= 0.01 && this.lastBrakeIntensity > 0)) {
      this.lastBrakeIntensity = brakeTemp;
      const mat = this.brakeDiscMaterial;
      if (brakeTemp > 0.02) {
        // Planckian blackbody incandescent radiation curve:
        // Deep cherry red -> fiery orange -> incandescent gold core
        const r = Math.min(1.0, brakeTemp * 1.35);
        const g = Math.max(0.0, Math.pow(brakeTemp, 2.2) * 0.72);
        const b = Math.max(0.0, Math.pow(brakeTemp, 3.5) * 0.28);
        mat.emissive.setRGB(r, g, b);
        mat.emissiveIntensity = brakeTemp * 4.2;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }

    // 4. FIA Rear LED Safety Cluster & ERS Energy Recovery Strobe (State-cached)
    const isBraking = brake > 0.10;
    const isHarvesting = !isBraking && (speedKmh > 10 && (speedKmh < 85 || throttle < 0.25));
    const strobePhase = Math.floor(this.flameGlobalTime * 8) % 2 === 0;

    let targetLightIntensity = 0.5;
    let targetLightColor = 0xaa0510;

    if (isBraking) {
      targetLightIntensity = 4.2;
      targetLightColor = 0xff0020;
    } else if (isHarvesting && strobePhase) {
      targetLightIntensity = 3.6;
      targetLightColor = 0xff2200;
    } else if (isHarvesting) {
      targetLightIntensity = 0.15;
      targetLightColor = 0x330005;
    }

    if (this.lastBrakeLit !== (isBraking || (isHarvesting && strobePhase))) {
      this.lastBrakeLit = isBraking || (isHarvesting && strobePhase);
      this.taillightMaterial.emissiveIntensity = targetLightIntensity;
      this.taillightMaterial.color.setHex(targetLightColor);
      this.taillightMaterial.emissive.setHex(targetLightColor);
    }

    // 5. Inconel Exhaust Thermal Glow & Backfire Flames
    const targetGlow = Math.min(2.4, (speedKmh / 210) * 2.0);
    this.exhaustGlowMat.emissiveIntensity = THREE.MathUtils.lerp(
      this.exhaustGlowMat.emissiveIntensity,
      targetGlow,
      0.08
    );

    if (isBackfiring && !this.backfireState.active) {
      this.triggerBackfire(false);
    }

    this.flameGlobalTime += dt;
    if (this.backfireState.active) {
      this.backfireState.phaseTime += dt;
      const progress = this.backfireState.phaseTime / this.backfireState.totalDuration;

      if (progress >= 1.0) {
        this.backfireState.active = false;
        this.exhaustFlameMeshes.forEach((m) => (m.visible = false));
        if (this.exhaustPointLight) this.exhaustPointLight.intensity = 0;
      } else {
        const flameIntensity = Math.sin(progress * Math.PI);
        this.exhaustFlameMaterials.forEach((mat) => {
          mat.uniforms.uTime.value = this.flameGlobalTime;
          mat.uniforms.uIntensity.value = flameIntensity;
        });
        if (this.exhaustPointLight) this.exhaustPointLight.intensity = flameIntensity * 4.5;
      }
    }

    // --- STOCHASTIC TURBULENCE & AERODYNAMIC DYNAMIC PRESSURE (q = 1/2 * rho * v^2) ---
    this.wingFlutterTime += dt;
    const speedRatio = Math.max(0, speedKmh / 100.0);
    const dynPressure = speedRatio * speedRatio; // Aerodynamic load scales quadratic with speed
    const aeroLoadScale = Math.min(3.5, Math.max(0.04, speedRatio));

    // Turbulent wind gust generator (pseudo-Perlin stochastic eddy shedding)
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gustTimer = 0.08 + Math.random() * 0.16;
      this.gustTarget = (Math.random() - 0.5) * 2.0;
    }
    this.gustTurbulence += (this.gustTarget - this.gustTurbulence) * Math.min(1.0, dt * 12.0);

    const springK = 260.0;
    const dampC = 20.0;

    // =========================================================================
    // 6. REAR WING STRUCTURAL AEROELASTIC FLUTTER & 2ND-ORDER SPRING OSCILLATOR
    // =========================================================================
    if (this.wingGroup) {
      const isDamaged = Boolean(
        damage.wingLoose ||
        damage.rearWingLeftDetached ||
        damage.rearWingRightDetached ||
        (damage.wingDamageAmount && damage.wingDamageAmount > 0)
      );

      if (isDamaged) {
        const leftBroken = Boolean(damage.rearWingLeftDetached);
        const rightBroken = Boolean(damage.rearWingRightDetached);
        const totalSevered = leftBroken && rightBroken;
        const damageSeverity = Math.min(1.0, (damage.wingDamageAmount || 0) + (leftBroken || rightBroken ? 0.45 : 0.2));

        if (this.rwEndplateLeft) this.rwEndplateLeft.visible = !leftBroken;
        if (this.rwPylonLeft) this.rwPylonLeft.visible = !leftBroken;
        if (this.rwEndplateRight) this.rwEndplateRight.visible = !rightBroken;
        if (this.rwPylonRight) this.rwPylonRight.visible = !rightBroken;

        // --- Multi-Octave Harmonic & Turbulent Wave Synthesis ---
        // Mode 1: Main Torsional/Flexural resonance (~15.2 Hz with golden ratio non-repeating sub-harmonic)
        const t = this.wingFlutterTime;
        const freqMode1 = 15.2 * Math.sqrt(aeroLoadScale);
        const mode1 = (Math.sin(t * freqMode1) * 0.65 + Math.sin(t * freqMode1 * 1.618) * 0.35) * 0.048 * damageSeverity;

        // Mode 2: Engine/Diffuser Airbox Vortex Shedding Buffeting (~27.4 Hz coupled with gusts)
        const mode2 = Math.cos(t * 27.4 + this.gustTurbulence * 1.4) * (0.030 + Math.abs(this.gustTurbulence) * 0.018) * aeroLoadScale * damageSeverity;

        // Mode 3: High-Frequency Carbon Fiber Micro-Chatter (~62 Hz loose mounting vibration)
        const mode3 = Math.sin(t * 62.0) * 0.012 * Math.min(2.0, dynPressure) * damageSeverity;

        // Inertial G coupling from cornering steering and braking
        const latInertiaRoll = -steerAngle * dynPressure * 0.08;
        const latInertiaYaw = steerAngle * dynPressure * 0.06;
        const brakePitch = brake * dynPressure * 0.035;

        // Base static structural collapse / mean downforce pushback
        let baseRoll = 0;
        let baseYaw = 0;
        let basePitch = -dynPressure * 0.025 * damageSeverity + brakePitch;
        let basePosY = -dynPressure * 0.018 * damageSeverity;
        let basePosZ = 0;

        if (totalSevered || (damage.wingDamageAmount || 0) > 0.70) {
          // Severed both pylons: collapsed flat onto rear bodywork & diffuser
          basePosY = -0.22;
          basePosZ = -0.06;
          basePitch = -0.28;
          baseRoll = this.gustTurbulence * 0.03;
        } else if (leftBroken) {
          // Left pylon severed: severe leftward asymmetric droop & cant
          baseRoll = 0.26 + dynPressure * 0.06;
          baseYaw = 0.14;
          basePitch = 0.10 - dynPressure * 0.03;
          basePosY = -0.10;
          basePosZ = -0.02;
        } else if (rightBroken) {
          // Right pylon severed: severe rightward asymmetric droop & cant
          baseRoll = -0.26 - dynPressure * 0.06;
          baseYaw = -0.14;
          basePitch = 0.10 - dynPressure * 0.03;
          basePosY = -0.10;
          basePosZ = -0.02;
        } else {
          // Loosened mountings: aero load tilts and twists wing
          baseRoll = (damage.wingDamageAmount || 0) * 0.12;
          baseYaw = (damage.wingDamageAmount || 0) * 0.06;
          basePosY = -0.02 * damageSeverity;
        }

        // Target state combining aerodynamic sag, harmonic flutter, chatter and inertial bias
        const targetRoll = baseRoll + (mode1 + mode2 + mode3) * aeroLoadScale + latInertiaRoll;
        const targetPitch = basePitch + (mode1 * 0.55 + mode2 * 0.75 + mode3 * 0.4) * aeroLoadScale;
        const targetYaw = baseYaw + (mode1 * 0.4 + mode2 * 0.3) * aeroLoadScale + latInertiaYaw;
        const targetPosY = basePosY + (mode1 + mode2 * 0.6) * 0.018 * aeroLoadScale;
        const targetPosZ = basePosZ;

        // 2nd-Order Spring-Damper Physics Integration (Smooth, organic mechanical oscillation)
        const accelRoll = (targetRoll - this.rearWingOscAngle.roll) * springK - this.rearWingOscVel.roll * dampC;
        this.rearWingOscVel.roll += accelRoll * dt;
        this.rearWingOscAngle.roll += this.rearWingOscVel.roll * dt;

        const accelPitch = (targetPitch - this.rearWingOscAngle.pitch) * springK - this.rearWingOscVel.pitch * dampC;
        this.rearWingOscVel.pitch += accelPitch * dt;
        this.rearWingOscAngle.pitch += this.rearWingOscVel.pitch * dt;

        const accelYaw = (targetYaw - this.rearWingOscAngle.yaw) * springK - this.rearWingOscVel.yaw * dampC;
        this.rearWingOscVel.yaw += accelYaw * dt;
        this.rearWingOscAngle.yaw += this.rearWingOscVel.yaw * dt;

        const accelPosY = (targetPosY - this.rearWingOscAngle.y) * springK - this.rearWingOscVel.y * dampC;
        this.rearWingOscVel.y += accelPosY * dt;
        this.rearWingOscAngle.y += this.rearWingOscVel.y * dt;

        this.wingGroup.rotation.set(this.rearWingOscAngle.pitch, this.rearWingOscAngle.yaw, this.rearWingOscAngle.roll);
        this.wingGroup.position.set(0, this.rearWingOscAngle.y, targetPosZ);

        // Broken DRS Flap High-Frequency Flutter
        if (this.drsPivotGroup) {
          if (damage.drsFlapBroken || totalSevered) {
            const drsFreq = 42.0 * Math.sqrt(aeroLoadScale);
            const drsFlutter = (Math.sin(t * drsFreq) * 0.6 + Math.sin(t * drsFreq * 1.414) * 0.4) * 0.075 * aeroLoadScale;
            const drsTargetZ = 0.30 + drsFlutter + this.gustTurbulence * 0.05;
            const drsTargetX = 0.42 + Math.cos(t * 26.0) * 0.04 * aeroLoadScale;

            const accelDrsZ = (drsTargetZ - this.drsOscAngle.roll) * 320.0 - this.drsOscVel.roll * 24.0;
            this.drsOscVel.roll += accelDrsZ * dt;
            this.drsOscAngle.roll += this.drsOscVel.roll * dt;

            const accelDrsX = (drsTargetX - this.drsOscAngle.pitch) * 320.0 - this.drsOscVel.pitch * 24.0;
            this.drsOscVel.pitch += accelDrsX * dt;
            this.drsOscAngle.pitch += this.drsOscVel.pitch * dt;

            this.drsPivotGroup.rotation.z = this.drsOscAngle.roll;
            this.drsPivotGroup.rotation.x = this.drsOscAngle.pitch;
          }
        }
      } else {
        // Pristine Wing: smoothly return to rest
        if (this.rwEndplateLeft) this.rwEndplateLeft.visible = true;
        if (this.rwPylonLeft) this.rwPylonLeft.visible = true;
        if (this.rwEndplateRight) this.rwEndplateRight.visible = true;
        if (this.rwPylonRight) this.rwPylonRight.visible = true;

        this.rearWingOscAngle.roll += (0 - this.rearWingOscAngle.roll) * Math.min(1.0, dt * 18.0);
        this.rearWingOscAngle.pitch += (0 - this.rearWingOscAngle.pitch) * Math.min(1.0, dt * 18.0);
        this.rearWingOscAngle.yaw += (0 - this.rearWingOscAngle.yaw) * Math.min(1.0, dt * 18.0);
        this.rearWingOscAngle.y += (0 - this.rearWingOscAngle.y) * Math.min(1.0, dt * 18.0);
        this.rearWingOscVel.roll = 0;
        this.rearWingOscVel.pitch = 0;
        this.rearWingOscVel.yaw = 0;
        this.rearWingOscVel.y = 0;

        this.wingGroup.rotation.set(this.rearWingOscAngle.pitch, this.rearWingOscAngle.yaw, this.rearWingOscAngle.roll);
        this.wingGroup.position.set(0, this.rearWingOscAngle.y, 0);
      }
    }

    // =========================================================================
    // 7. FRONT WING GROUND-EFFECT VENTURI BUFFETING & ASPHALT CLATTER PHYSICS
    // =========================================================================
    if (this.frontWingGroup) {
      // Overall front nose assembly pitch down with nosecone crumple
      this.frontWingGroup.rotation.x = -damage.frontCrumple * 0.20;

      const t = this.wingFlutterTime;

      // Left Semi-Wing Cascade
      if (this.frontWingLeftGroup) {
        const lDmg = damage.frontWingLeftDamage || 0;
        const lMainDetached = Boolean(damage.frontWingLeftDetached || lDmg > 0.88);
        const lUpperDetached = Boolean(damage.frontWingLeftUpperFlapDetached || lDmg > 0.55 || lMainDetached);
        const lEndplateDetached = Boolean(damage.endplateLeftDetached || lDmg > 0.35 || lMainDetached);

        // Visibility of multi-stage fractured sub-assemblies
        if (this.frontWingLeftMainGroup) this.frontWingLeftMainGroup.visible = !lMainDetached;
        if (this.frontWingLeftUpperFlapGroup) this.frontWingLeftUpperFlapGroup.visible = !lUpperDetached && !lMainDetached;
        if (this.endplateLeftGroup) this.endplateLeftGroup.visible = !lEndplateDetached && !lMainDetached;
        if (this.frontWingLeftStubMesh) this.frontWingLeftStubMesh.visible = lMainDetached;

        if (!lMainDetached && lDmg > 0.05) {
          // Venturi Ground-Effect Suction Pulsation (increases with sqrt(v))
          const fwFreq = 24.0 * Math.sqrt(aeroLoadScale);
          const geBuffet = (Math.sin(t * fwFreq) * 0.70 + Math.sin(t * fwFreq * 1.618) * 0.30) * 0.048 * lDmg * aeroLoadScale;
          const geChatter = Math.sin(t * 72.0) * 0.012 * Math.min(2.5, dynPressure) * lDmg;

          // Droop increases with damage and aero dynamic pressure
          let targetRoll = -lDmg * 0.32 - dynPressure * 0.024 * lDmg + geBuffet + geChatter;
          let targetPitch = -lDmg * 0.18 - dynPressure * 0.018 * lDmg + geBuffet * 0.5;
          let targetY = -lDmg * 0.092 - dynPressure * 0.015 * lDmg;

          // Ground Contact Plane: Wing cannot penetrate through the asphalt!
          // When it hits the ground, apply elastic rebound kick upward (Asphalt Clatter)
          const currentOuterTipY = 0.12 + targetY + Math.sin(targetRoll) * 0.95;
          if (currentOuterTipY < 0.015) {
            const penetration = 0.015 - currentOuterTipY;
            targetY += penetration * 0.65;
            targetRoll += penetration * 0.85;
            this.frontWingLeftVel.y += (penetration * 260.0 + Math.random() * 4.0) * dt;
          }

          const accelRoll = (targetRoll - this.frontWingLeftOsc.roll) * 320.0 - this.frontWingLeftVel.roll * 24.0;
          this.frontWingLeftVel.roll += accelRoll * dt;
          this.frontWingLeftOsc.roll += this.frontWingLeftVel.roll * dt;

          const accelPitch = (targetPitch - this.frontWingLeftOsc.pitch) * 320.0 - this.frontWingLeftVel.pitch * 24.0;
          this.frontWingLeftVel.pitch += accelPitch * dt;
          this.frontWingLeftOsc.pitch += this.frontWingLeftVel.pitch * dt;

          const accelY = (targetY - this.frontWingLeftOsc.y) * 320.0 - this.frontWingLeftVel.y * 24.0;
          this.frontWingLeftVel.y += accelY * dt;
          this.frontWingLeftOsc.y += this.frontWingLeftVel.y * dt;

          this.frontWingLeftGroup.rotation.z = this.frontWingLeftOsc.roll;
          this.frontWingLeftGroup.rotation.x = this.frontWingLeftOsc.pitch;
          this.frontWingLeftGroup.position.y = this.frontWingLeftOsc.y;
        } else if (!lMainDetached) {
          this.frontWingLeftGroup.rotation.set(0, 0, 0);
          this.frontWingLeftGroup.position.set(0, 0, 0);
        }
      }

      // Right Semi-Wing Cascade
      if (this.frontWingRightGroup) {
        const rDmg = damage.frontWingRightDamage || 0;
        const rMainDetached = Boolean(damage.frontWingRightDetached || rDmg > 0.88);
        const rUpperDetached = Boolean(damage.frontWingRightUpperFlapDetached || rDmg > 0.55 || rMainDetached);
        const rEndplateDetached = Boolean(damage.endplateRightDetached || rDmg > 0.35 || rMainDetached);

        if (this.frontWingRightMainGroup) this.frontWingRightMainGroup.visible = !rMainDetached;
        if (this.frontWingRightUpperFlapGroup) this.frontWingRightUpperFlapGroup.visible = !rUpperDetached && !rMainDetached;
        if (this.endplateRightGroup) this.endplateRightGroup.visible = !rEndplateDetached && !rMainDetached;
        if (this.frontWingRightStubMesh) this.frontWingRightStubMesh.visible = rMainDetached;

        if (!rMainDetached && rDmg > 0.05) {
          const fwFreq = 24.0 * Math.sqrt(aeroLoadScale);
          // Phase shifted for natural organic asymmetry
          const geBuffet = (Math.sin(t * fwFreq + 1.1) * 0.70 + Math.sin(t * fwFreq * 1.618 + 2.2) * 0.30) * 0.048 * rDmg * aeroLoadScale;
          const geChatter = Math.sin(t * 72.0 + 1.6) * 0.012 * Math.min(2.5, dynPressure) * rDmg;

          let targetRoll = rDmg * 0.32 + dynPressure * 0.024 * rDmg - geBuffet - geChatter;
          let targetPitch = -rDmg * 0.18 - dynPressure * 0.018 * rDmg + geBuffet * 0.5;
          let targetY = -rDmg * 0.092 - dynPressure * 0.015 * rDmg;

          const currentOuterTipY = 0.12 + targetY - Math.sin(targetRoll) * 0.95;
          if (currentOuterTipY < 0.015) {
            const penetration = 0.015 - currentOuterTipY;
            targetY += penetration * 0.65;
            targetRoll -= penetration * 0.85;
            this.frontWingRightVel.y += (penetration * 260.0 + Math.random() * 4.0) * dt;
          }

          const accelRoll = (targetRoll - this.frontWingRightOsc.roll) * 320.0 - this.frontWingRightVel.roll * 24.0;
          this.frontWingRightVel.roll += accelRoll * dt;
          this.frontWingRightOsc.roll += this.frontWingRightVel.roll * dt;

          const accelPitch = (targetPitch - this.frontWingRightOsc.pitch) * 320.0 - this.frontWingRightVel.pitch * 24.0;
          this.frontWingRightVel.pitch += accelPitch * dt;
          this.frontWingRightOsc.pitch += this.frontWingRightVel.pitch * dt;

          const accelY = (targetY - this.frontWingRightOsc.y) * 320.0 - this.frontWingRightVel.y * 24.0;
          this.frontWingRightVel.y += accelY * dt;
          this.frontWingRightOsc.y += this.frontWingRightVel.y * dt;

          this.frontWingRightGroup.rotation.z = this.frontWingRightOsc.roll;
          this.frontWingRightGroup.rotation.x = this.frontWingRightOsc.pitch;
          this.frontWingRightGroup.position.y = this.frontWingRightOsc.y;
        } else if (!rMainDetached) {
          this.frontWingRightGroup.rotation.set(0, 0, 0);
          this.frontWingRightGroup.position.set(0, 0, 0);
        }
      }
    }

    // 8. Visual Crumple Zone Deformation with Asymmetric Denting
    this.applyVertexDeformation(damage);

    // 8. F1 Steering Wheel & Driver Helmet Animation
    const targetSteerAngle = steerAngle * 2.8;
    this.currentSteerAnim += (targetSteerAngle - this.currentSteerAnim) * 0.35;

    if (this.steeringWheel) {
      this.steeringWheel.rotation.z = this.currentSteerAnim;
    }

    if (this.driverHelmet) {
      const helmetTiltTargetZ = -steerAngle * 0.14;
      const helmetYawTargetY = steerAngle * 0.20;
      const helmetPitchTargetX = (brake > 0.15 ? 0.055 : 0) - (throttle > 0.8 && speedKmh < 120 ? 0.025 : 0);
      this.driverHelmet.rotation.z += (helmetTiltTargetZ - this.driverHelmet.rotation.z) * 0.25;
      this.driverHelmet.rotation.y += (helmetYawTargetY - this.driverHelmet.rotation.y) * 0.25;
      this.driverHelmet.rotation.x += (helmetPitchTargetX - this.driverHelmet.rotation.x) * 0.22;
    }

    // 9. Shift Rev LEDs (Updated only when active LED threshold changes)
    if (this.revLedMeshes.length > 0) {
      const rpmRatio = Math.min(1.0, Math.max(0, (rpm - 2200) / 7000));
      const totalLeds = this.revLedMeshes.length;
      const activeLeds = rpmRatio > 0.05 ? Math.floor(rpmRatio * totalLeds) : -1;
      if (activeLeds !== this.lastActiveLeds) {
        this.lastActiveLeds = activeLeds;
        for (let i = 0; i < totalLeds; i++) {
          const mat = this.revLedMeshes[i].material as THREE.MeshBasicMaterial;
          if (i <= activeLeds && activeLeds >= 0) {
            const color = i < 2 ? 0x22c55e : i < 5 ? 0xeab308 : 0xef4444;
            mat.color.setHex(color);
          } else {
            mat.color.setHex(0x18181b);
          }
        }
      }
    }
  }

  /**
   * Hardware GPU-accelerated morph target crash deformation.
   * Runs in 0.00ms CPU time with zero vertex iteration, zero bus uploads, and zero normal recomputations.
   */
  private applyVertexDeformation(damage: DamageState): void {
    if (this.isAi || !this.noseMesh || !this.noseMesh.morphTargetInfluences) return;

    const safeCrumple = Number.isFinite(damage.frontCrumple) ? Math.max(0, Math.min(1.0, damage.frontCrumple)) : 0;
    const lDmg = Math.min(1.0, damage.frontWingLeftDamage || 0);
    const rDmg = Math.min(1.0, damage.frontWingRightDamage || 0);

    this.noseMesh.morphTargetInfluences[0] = safeCrumple;
    this.noseMesh.morphTargetInfluences[1] = lDmg;
    this.noseMesh.morphTargetInfluences[2] = rDmg;
  }

  private modelLoadGeneration: number = 0;

  /**
   * Deep GPU resource cleanup helper for custom imported 3D models (using Sets to prevent double-disposal)
   */
  private disposeCustomModel(): void {
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();

    this.customModelGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry && !disposedGeos.has(obj.geometry)) {
          disposedGeos.add(obj.geometry);
          obj.geometry.dispose();
        }
        if (obj.material) {
          const mats = (Array.isArray(obj.material) ? obj.material : [obj.material]) as THREE.Material[];
          mats.forEach((m: THREE.Material) => {
            if (disposedMats.has(m)) return;
            disposedMats.add(m);
            const anyMat = m as any;
            const texProps = [
              'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap',
              'normalMap', 'displacementMap', 'roughnessMap', 'metalnessMap',
              'alphaMap', 'envMap'
            ];
            for (let i = 0; i < texProps.length; i++) {
              const tex = anyMat[texProps[i]];
              if (tex && typeof tex.dispose === 'function' && !disposedTextures.has(tex)) {
                disposedTextures.add(tex);
                tex.dispose();
              }
            }
            m.dispose();
          });
        }
      }
    });
    this.customModelGroup.clear();
    this.customWheelMeshes = [];
    this.customWheelPivotsFront = [];
  }

  /**
   * Load custom player 3D model (.glb, .gltf, .zip, .obj) and substitute vehicle
   */
  public async loadCustomModel(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    const gen = ++this.modelLoadGeneration;
    try {
      const imported = await CarModelImporter.loadFromFile(file);
      if (gen !== this.modelLoadGeneration) {
        // Obsolete or superseded async load; cleanly dispose and abort
        imported.rootGroup.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((m) => m.dispose());
            }
          }
        });
        return { success: false, name: file.name, error: 'Carga cancelada.' };
      }

      this.disposeCustomModel();
      this.customModelGroup.add(imported.rootGroup);
      this.customModelGroup.visible = true;
      this.proceduralBodyGroup.visible = false;
      this.isCustomModel = true;
      this.currentModelName = imported.name;
      this.customWheelMeshes = imported.wheelMeshes;
      this.customWheelPivotsFront = imported.wheelPivotsFront;

      this.wheelMeshes.forEach((w) => {
        w.visible = false;
      });
      this.ensureCastShadows();

      return { success: true, name: imported.name };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, name: file.name, error: msg };
    }
  }

  /**
   * Restore the default procedural competition model
   */
  public restoreDefaultModel(): void {
    this.modelLoadGeneration++;
    this.disposeCustomModel();
    this.customModelGroup.visible = false;
    this.proceduralBodyGroup.visible = true;
    this.wheelMeshes.forEach((w) => {
      w.visible = true;
    });
    this.ensureCastShadows();
    this.isCustomModel = false;
    this.currentModelName = 'Apex F1 Turbo GP';
  }

  /**
   * Underbody Ambient Occlusion & Soft Ground Contact Shadow Plate
   * Ultra-high-fidelity contact shadow anchoring the F1 chassis and 4 competition tires
   * directly to the tarmac. Eliminates the floating-car look with zero frametime overhead.
   */
  private buildUnderbodyContactShadow(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // 1. Broad soft ambient occlusion envelope around entire footprint
    const ambientGrad = ctx.createRadialGradient(512, 512, 100, 512, 512, 480);
    ambientGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.70)');
    ambientGrad.addColorStop(0.40, 'rgba(0, 0, 0, 0.45)');
    ambientGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.18)');
    ambientGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. Underfloor plank & venturi aero tunnel deep ground occlusion (X: 250-774, Y: 180-730)
    // Deep dark core directly beneath cockpit, sidepods, and floorboard
    const underfloorGrad = ctx.createLinearGradient(0, 180, 0, 730);
    underfloorGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.90)'); // Rear diffuser exit
    underfloorGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.96)'); // Engine bay undertray
    underfloorGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.96)'); // Cockpit floor plank
    underfloorGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.88)'); // Front tea-tray
    ctx.fillStyle = underfloorGrad;
    ctx.beginPath();
    ctx.roundRect(240, 180, 544, 550, 48);
    ctx.fill();

    // 3. Central keel plank maximum umbra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.98)';
    ctx.beginPath();
    ctx.roundRect(360, 200, 304, 520, 24);
    ctx.fill();

    // 4. Front wing ground ground-effect shadow wash (Y: 740 - 960)
    const fwGrad = ctx.createLinearGradient(0, 740, 0, 960);
    fwGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.85)');
    fwGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.65)');
    fwGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = fwGrad;
    ctx.beginPath();
    ctx.moveTo(140, 760);
    ctx.lineTo(884, 760);
    ctx.lineTo(840, 950);
    ctx.lineTo(184, 950);
    ctx.closePath();
    ctx.fill();

    // 5. Rear wing & beam wing diffuser plume shadow wash (Y: 60 - 200)
    const rwGrad = ctx.createLinearGradient(0, 200, 0, 60);
    rwGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.88)');
    rwGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.55)');
    rwGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = rwGrad;
    ctx.beginPath();
    ctx.moveTo(180, 200);
    ctx.lineTo(844, 200);
    ctx.lineTo(820, 70);
    ctx.lineTo(204, 70);
    ctx.closePath();
    ctx.fill();

    // 6. The 4 High-Load Tire Ground Contact Patches (Exact physical wheel coordinates)
    // Front Axle (Z = +1.35m -> Y = 759), FL (X = -0.92m -> px 176), FR (X = +0.92m -> px 848)
    // Rear Axle (Z = -1.35m -> Y = 265), RL (X = -0.96m -> px 161), RR (X = +0.96m -> px 863)
    const tires = [
      { cx: 176, cy: 759, rx: 56, ry: 42, blur: 28 }, // FL
      { cx: 848, cy: 759, rx: 56, ry: 42, blur: 28 }, // FR
      { cx: 161, cy: 265, rx: 72, ry: 50, blur: 32 }, // RL (wider 380mm rear slick)
      { cx: 863, cy: 265, rx: 72, ry: 50, blur: 32 }, // RR
    ];

    tires.forEach((t) => {
      // Soft contact halo
      const haloGrad = ctx.createRadialGradient(t.cx, t.cy, 8, t.cx, t.cy, t.rx + t.blur);
      haloGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.95)');
      haloGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.70)');
      haloGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.ellipse(t.cx, t.cy, t.rx + t.blur, t.ry + t.blur, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pitch-black rubber tread contact core (Umbra)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.99)';
      ctx.beginPath();
      ctx.ellipse(t.cx, t.cy, t.rx, t.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    this.underbodyShadowTexture = tex;

    // Plane geometry precisely scaled to vehicle footprint (2.80m wide x 5.60m long)
    const geo = new THREE.PlaneGeometry(2.8, 5.6);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
    });
    this.underbodyShadowMaterial = mat;

    const contactMesh = new THREE.Mesh(geo, mat);
    contactMesh.position.set(0, 0.008, 0.0);
    contactMesh.renderOrder = 4;
    this.group.add(contactMesh);
    this.contactShadowMesh = contactMesh;
  }

  /**
   * Real-time Electro-Hydraulic F1 DRS Flap Articulation & Active Optical Telemetry
   * - Closed Position (0.12 rad, Y = 0.88): Compact locked downforce slot gap (15mm)
   * - Open Position (-0.72 rad, Y = 1.06): Massive 240mm (24cm) crystal-clear open aperture!
   * - Full View Clearance: Flap & banner lift high above the mainplane, revealing cockpit & road ahead
   * - Hydraulic Kinematics: 18cm vertical lift + 41.3° tilt + 15cm chrome ram extension + rocker rotation
   * - High-Speed Micro-Flutter: High-frequency boundary layer vibration (> 120 km/h)
   * - Optical DRS Telemetry: Emerald LED beacon + localized high-intensity PointLight illumination
   */
  public setDRS(isOpen: boolean, dt: number = 0.016, speedKmh: number = 0): void {
    if (!this.drsPivotGroup) return;

    const CLOSED_ANGLE = 0.12;  // High Downforce closed inclination (~6.9 deg)
    const OPEN_ANGLE = -0.72;   // Ultra-high lift streamlined open inclination (~-41.3 deg)
    const targetAngle = isOpen ? OPEN_ANGLE : CLOSED_ANGLE;

    // Realistic asymmetrical hydraulic valve rate:
    // Snaps open under 200-bar hydraulic impulse (~0.10s), slams shut even faster under aero downforce (~0.05s)
    const transitionRate = isOpen ? 22.0 : 36.0;
    this.currentDrsAngle += (targetAngle - this.currentDrsAngle) * Math.min(1.0, transitionRate * dt);

    // Normalized open factor: 0.0 (fully closed) -> 1.0 (fully open)
    const openFactor = THREE.MathUtils.clamp(
      (CLOSED_ANGLE - this.currentDrsAngle) / (CLOSED_ANGLE - OPEN_ANGLE),
      0.0,
      1.0
    );

    // High-speed aerodynamic turbulence micro-flutter on the articulated blade
    const flutter = (isOpen && speedKmh > 120.0)
      ? Math.sin(performance.now() * 0.045) * 0.0022 * Math.min(1.0, speedKmh / 240.0)
      : 0.0;

    // Synchronized vertical hydraulic lift + rotation:
    // Elevates the pivot axis by 18cm and shifts forward by 4cm, lifting the flap & banner completely
    // out of the way to expose a huge 24cm open window through which the chase camera sees the road!
    const liftY = openFactor * 0.18;
    const shiftZ = openFactor * 0.04;
    this.drsPivotGroup.position.set(0, 0.88 + liftY, -1.86 + shiftZ);
    this.drsPivotGroup.rotation.x = this.currentDrsAngle + flutter;

    // 1. Extend and tilt polished chrome hydraulic ram piston linked to flap clevis lug
    if (this.drsPistonMesh) {
      this.drsPistonMesh.scale.z = 1.0 + openFactor * 4.2;
      this.drsPistonMesh.position.z = -0.04 - openFactor * 0.085;
      this.drsPistonMesh.position.y = 0.028 + openFactor * 0.085;
      this.drsPistonMesh.rotation.x = openFactor * 0.45;
    }

    // 2. Kinematic rotation of dual carbon bellcrank rocker arms
    const rockerAngle = openFactor * 0.75;
    if (this.drsRockerArmLeft) this.drsRockerArmLeft.rotation.x = rockerAngle;
    if (this.drsRockerArmRight) this.drsRockerArmRight.rotation.x = rockerAngle;

    // 3. DRS Status Telemetry LED & localized Emerald Glow PointLight
    if (this.drsLedMaterial) {
      if (openFactor > 0.06) {
        this.drsLedMaterial.color.setHex(0x10b981); // Vivid Emerald Green
        this.drsLedMaterial.emissive.setHex(0x10b981);
        this.drsLedMaterial.emissiveIntensity = 4.2 + Math.sin(performance.now() * 0.03) * 0.8;
        if (this.drsPointLight) {
          this.drsPointLight.intensity = openFactor * 3.5;
        }
      } else {
        this.drsLedMaterial.color.setHex(0x1e293b); // Standby Stealth Slate
        this.drsLedMaterial.emissive.setHex(0x0f172a);
        this.drsLedMaterial.emissiveIntensity = 0.15;
        if (this.drsPointLight) {
          this.drsPointLight.intensity = 0.0;
        }
      }
    }
  }

  /**
   * Dynamically update team livery, sponsor decals, and driver numbers
   */
  public setLivery(livery: TeamLiveryConfig): void {
    this.liveryConfig = livery;

    // Dispose previous livery canvas textures to prevent VRAM accumulation
    if (this.liveryTexture) this.liveryTexture.dispose();
    if (this.rearWingTexture) this.rearWingTexture.dispose();
    if (this.sharkFinTexture) this.sharkFinTexture.dispose();
    if (this.haloDecalTexture) this.haloDecalTexture.dispose();
    if (this.endplateDecalTexture) this.endplateDecalTexture.dispose();
    if (this.frontWingFlapTexture) this.frontWingFlapTexture.dispose();

    this.createLiveryTexture();
    this.rearWingTexture = this.createRearWingDecalTexture();
    this.sharkFinTexture = this.createSharkFinDecalTexture();
    this.haloDecalTexture = this.createHaloDecalTexture();
    this.endplateDecalTexture = this.createEndplateDecalTexture();
    this.frontWingFlapTexture = this.createFrontWingFlapTexture();

    if (this.bodyMaterial) {
      this.bodyMaterial.map = this.liveryTexture;
      this.bodyMaterial.needsUpdate = true;
    }
    if (this.rearWingMaterial) {
      this.rearWingMaterial.map = this.rearWingTexture;
      this.rearWingMaterial.needsUpdate = true;
    }
    if (this.sharkFinMaterial) {
      this.sharkFinMaterial.map = this.sharkFinTexture;
      this.sharkFinMaterial.needsUpdate = true;
    }
    if (this.haloDecalMaterial) {
      this.haloDecalMaterial.map = this.haloDecalTexture;
      this.haloDecalMaterial.needsUpdate = true;
    }
    if (this.endplateDecalMaterial) {
      this.endplateDecalMaterial.map = this.endplateDecalTexture;
      this.endplateDecalMaterial.needsUpdate = true;
    }
    if (this.frontWingFlapMaterial) {
      this.frontWingFlapMaterial.map = this.frontWingFlapTexture;
      this.frontWingFlapMaterial.needsUpdate = true;
    }
    if (this.helmetShellMat) {
      const hColor = this.liveryConfig.accentColor || this.liveryConfig.secondaryColor || '#f1f5f9';
      this.helmetShellMat.color.set(hColor);
      this.helmetShellMat.needsUpdate = true;
    }
  }

  /**
   * Complete GPU resource and texture cleanup for the vehicle model
   */
  public dispose(): void {
    this.modelLoadGeneration++;
    this.disposeCustomModel();

    if (this.underbodyShadowTexture) {
      this.underbodyShadowTexture.dispose();
      this.underbodyShadowTexture = undefined;
    }
    if (this.underbodyShadowMaterial) {
      this.underbodyShadowMaterial.dispose();
      this.underbodyShadowMaterial = undefined;
    }

    if (this.liveryTexture) this.liveryTexture.dispose();
    if (this.rearWingTexture) this.rearWingTexture.dispose();
    if (this.sharkFinTexture) this.sharkFinTexture.dispose();
    if (this.haloDecalTexture) this.haloDecalTexture.dispose();
    if (this.endplateDecalTexture) this.endplateDecalTexture.dispose();
    if (this.frontWingFlapTexture) this.frontWingFlapTexture.dispose();

    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry && !disposedGeos.has(obj.geometry)) {
          disposedGeos.add(obj.geometry);
          obj.geometry.dispose();
        }
        if (obj.material) {
          const mats = (Array.isArray(obj.material) ? obj.material : [obj.material]) as THREE.Material[];
          mats.forEach((m: THREE.Material) => {
            if (disposedMats.has(m)) return;
            disposedMats.add(m);
            const anyMat = m as any;
            const texProps = [
              'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap',
              'normalMap', 'displacementMap', 'roughnessMap', 'metalnessMap',
              'alphaMap', 'envMap'
            ];
            for (let i = 0; i < texProps.length; i++) {
              const tex = anyMat[texProps[i]];
              if (tex && typeof tex.dispose === 'function' && !disposedTextures.has(tex)) {
                disposedTextures.add(tex);
                tex.dispose();
              }
            }
            m.dispose();
          });
        }
      }
    });
  }
}
