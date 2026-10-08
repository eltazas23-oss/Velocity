/**
 * HumanCrewMeshBuilder.ts - High-Fidelity 3D Motorsport Mechanic Anatomy & Gear Factory
 *
 * Procedural generation of photorealistic Formula 1 & WEC pit crew mechanics:
 * 1. FIA 8860-2018 Aerodynamic Helmet with sculpted chin-bar, brow crest, iridescent visor,
 *    rear ducktail spoiler, HANS tether anchor posts & Stilo/Peltor headset.
 * 2. Nomex Multi-Layer Fire Suit with athletic V-taper, mandarin collar, shoulder rescue straps,
 *    YKK zipper, front/back sponsor patches & FIA safety seals.
 * 3. Articulated deltoids, curved biceps, elbows, racing gloves with silicone palm grip & contoured fingers.
 * 4. Articulated lower body with hexagonal Kevlar knee pads and Alpinestars/Puma racing boots.
 * 5. Lumbar telemetry radio battery pack with curly cord and flexible stubby antenna.
 * 6. Paoli DP 6000 pneumatic impact gun with overhead balancer rig and suspension cable.
 */

import * as THREE from 'three';
import { ArmIKJoints, LegJoints, CrewRoleType } from './PitStopManager';

export interface TeamMechanicVisualConfig {
  teamId: string;
  teamName: string;
  suitPrimaryHex: number;
  suitSecondaryHex: number;
  helmetColorHex: number;
  visorIridescenceHex: number;
  accentStripeHex: number;
  headsetHex: number;
  sponsorPrimary: string;
  sponsorSecondary: string;
}

export const OFFICIAL_TEAM_CONFIGS: Record<string, TeamMechanicVisualConfig> = {
  apex: {
    teamId: 'apex',
    teamName: 'ORACLE RED BULL',
    suitPrimaryHex: 0x091122, // Matte Midnight Navy Blue
    suitSecondaryHex: 0xdc2626,
    helmetColorHex: 0x091122,
    visorIridescenceHex: 0xffd000,
    accentStripeHex: 0xffd000,
    headsetHex: 0x09090b,
    sponsorPrimary: 'ORACLE',
    sponsorSecondary: 'RED BULL',
  },
  scuderia: {
    teamId: 'scuderia',
    teamName: 'SCUDERIA CORSA',
    suitPrimaryHex: 0xb91c1c, // Deep Modena Red
    suitSecondaryHex: 0x09090b,
    helmetColorHex: 0xb91c1c,
    visorIridescenceHex: 0x38bdf8,
    accentStripeHex: 0xfacc15,
    headsetHex: 0x18181b,
    sponsorPrimary: 'SANTANDER',
    sponsorSecondary: 'SHELL',
  },
};

export class HumanCrewMeshBuilder {
  private static suitFrontTextures = new Map<string, THREE.CanvasTexture>();
  private static suitBackTextures = new Map<string, THREE.CanvasTexture>();
  private static teamMaterialsMap = new Map<string, {
    suitFrontMat: THREE.MeshStandardMaterial;
    suitBackMat: THREE.MeshStandardMaterial;
    suitPrimaryMat: THREE.MeshStandardMaterial;
    suitDarkMat: THREE.MeshStandardMaterial;
    helmetShellMat: THREE.MeshStandardMaterial;
    visorMat: THREE.MeshStandardMaterial;
    rubberMat: THREE.MeshStandardMaterial;
    metalMat: THREE.MeshStandardMaterial;
    kevlarMat: THREE.MeshStandardMaterial;
    accentMat: THREE.MeshStandardMaterial;
    soleMat: THREE.MeshStandardMaterial;
    radioPackMat: THREE.MeshStandardMaterial;
    hansMat: THREE.MeshStandardMaterial;
    headsetMat: THREE.MeshStandardMaterial;
    socketMat: THREE.MeshStandardMaterial;
    pulleyMat: THREE.MeshStandardMaterial;
  }>();

  public static getTeamMaterials(config: TeamMechanicVisualConfig) {
    let mats = this.teamMaterialsMap.get(config.teamId);
    if (!mats) {
      const suitFrontTex = this.getSuitFrontTexture(config);
      const suitBackTex = this.getSuitBackTexture(config);

      mats = {
        suitFrontMat: new THREE.MeshStandardMaterial({
          map: suitFrontTex,
          roughness: 0.65,
          metalness: 0.08,
        }),
        suitBackMat: new THREE.MeshStandardMaterial({
          map: suitBackTex,
          roughness: 0.65,
          metalness: 0.08,
        }),
        suitPrimaryMat: new THREE.MeshStandardMaterial({
          color: config.suitPrimaryHex,
          roughness: 0.65,
          metalness: 0.08,
        }),
        suitDarkMat: new THREE.MeshStandardMaterial({
          color: config.suitSecondaryHex,
          roughness: 0.72,
          metalness: 0.05,
        }),
        helmetShellMat: new THREE.MeshStandardMaterial({
          color: config.helmetColorHex,
          roughness: 0.22,
          metalness: 0.45,
        }),
        visorMat: new THREE.MeshStandardMaterial({
          color: config.visorIridescenceHex,
          metalness: 0.90,
          roughness: 0.08,
        }),
        rubberMat: new THREE.MeshStandardMaterial({
          color: 0x141416,
          roughness: 0.88,
          metalness: 0.02,
        }),
        metalMat: new THREE.MeshStandardMaterial({
          color: 0x64748b,
          metalness: 0.92,
          roughness: 0.22,
        }),
        kevlarMat: new THREE.MeshStandardMaterial({
          color: 0x222226,
          roughness: 0.95,
          metalness: 0.04,
        }),
        accentMat: new THREE.MeshStandardMaterial({
          color: config.accentStripeHex,
          roughness: 0.60,
          metalness: 0.15,
        }),
        soleMat: new THREE.MeshStandardMaterial({
          color: 0x050505,
          roughness: 0.95,
        }),
        radioPackMat: new THREE.MeshStandardMaterial({
          color: 0x18181b,
          metalness: 0.7,
        }),
        hansMat: new THREE.MeshStandardMaterial({
          color: 0xef4444,
          metalness: 0.95,
          roughness: 0.2,
        }),
        headsetMat: new THREE.MeshStandardMaterial({
          color: config.headsetHex,
          roughness: 0.4,
          metalness: 0.6,
        }),
        socketMat: new THREE.MeshStandardMaterial({
          color: 0x09090b,
          metalness: 0.98,
          roughness: 0.15,
        }),
        pulleyMat: new THREE.MeshStandardMaterial({
          color: 0xeab308,
          metalness: 0.8,
          roughness: 0.25,
        }),
      };
      this.teamMaterialsMap.set(config.teamId, mats);
    }
    return mats;
  }

  /**
   * Generates a 1024x1024 procedural Nomex racing fire suit FRONT texture:
   * Micro-weave, athletic flank panels, contrast piping, central YKK racing zipper & puller,
   * metallic FIA safety buckle, chest sponsor patches, upper team banner & FIA 8856-2018 collar seal.
   */
  public static getSuitFrontTexture(cfg: TeamMechanicVisualConfig): THREE.CanvasTexture {
    if (this.suitFrontTextures.has(cfg.teamId)) {
      return this.suitFrontTextures.get(cfg.teamId)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const primHex = `#${cfg.suitPrimaryHex.toString(16).padStart(6, '0')}`;
    const secHex = `#${cfg.suitSecondaryHex.toString(16).padStart(6, '0')}`;
    const accHex = `#${cfg.accentStripeHex.toString(16).padStart(6, '0')}`;

    // 1. Base Nomex Fire-Retardant Fabric Weave
    ctx.fillStyle = primHex;
    ctx.fillRect(0, 0, 1024, 1024);

    // Micro-woven twill pattern
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let y = 0; y < 1024; y += 4) {
      ctx.fillRect(0, y, 1024, 1.5);
    }
    for (let x = 0; x < 1024; x += 4) {
      ctx.fillRect(x, 0, 1.5, 1024);
    }

    // 2. Athletic Side Flank Contrast Panels
    ctx.fillStyle = secHex;
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.lineTo(240, 240);
    ctx.lineTo(190, 800);
    ctx.lineTo(0, 840);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(1024, 160);
    ctx.lineTo(784, 240);
    ctx.lineTo(834, 800);
    ctx.lineTo(1024, 840);
    ctx.closePath();
    ctx.fill();

    // 3. High-Visibility Dynamic Piping Lines
    ctx.strokeStyle = accHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(240, 240);
    ctx.lineTo(190, 800);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(784, 240);
    ctx.lineTo(834, 800);
    ctx.stroke();

    // 4. Central YKK Racing Zipper & Flap
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(502, 110, 20, 530);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(512, 110);
    ctx.lineTo(512, 640);
    ctx.stroke();
    ctx.setLineDash([]);

    // Metallic Zipper Puller
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(506, 260, 12, 22);

    // 5. Waist Belt with Metallic FIA Buckle
    ctx.fillStyle = secHex;
    ctx.fillRect(160, 620, 704, 65);
    ctx.strokeStyle = accHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(160, 620, 704, 65);

    // Metallic Buckle
    ctx.fillStyle = '#64748b';
    ctx.fillRect(472, 615, 80, 75);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(492, 630, 40, 45);

    // 6. Chest Sponsor Badges & FIA Safety Seal
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(280, 280, 180, 65);
    ctx.fillStyle = '#09090b';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cfg.sponsorPrimary, 370, 322);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(564, 280, 180, 65);
    ctx.fillStyle = '#09090b';
    ctx.fillText(cfg.sponsorSecondary, 654, 322);

    // Team Banner on Upper Chest
    ctx.fillStyle = accHex;
    ctx.font = '900 italic 38px sans-serif';
    ctx.fillText(cfg.teamName, 512, 220);

    // Official FIA Standard 8856-2018 Hologram Emblem on collar
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(440, 130, 144, 40);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('FIA 8856-2018', 512, 156);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    this.suitFrontTextures.set(cfg.teamId, texture);
    return texture;
  }

  /**
   * Generates a 1024x1024 procedural Nomex racing fire suit BACK texture:
   * Team name prominently across the upper back shoulders, secondary sponsor logo,
   * waist belt continuation with lumbar stretch accordion ribs.
   */
  public static getSuitBackTexture(cfg: TeamMechanicVisualConfig): THREE.CanvasTexture {
    if (this.suitBackTextures.has(cfg.teamId)) {
      return this.suitBackTextures.get(cfg.teamId)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const primHex = `#${cfg.suitPrimaryHex.toString(16).padStart(6, '0')}`;
    const secHex = `#${cfg.suitSecondaryHex.toString(16).padStart(6, '0')}`;
    const accHex = `#${cfg.accentStripeHex.toString(16).padStart(6, '0')}`;

    // Base Nomex
    ctx.fillStyle = primHex;
    ctx.fillRect(0, 0, 1024, 1024);

    // Micro twill weave
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let y = 0; y < 1024; y += 4) {
      ctx.fillRect(0, y, 1024, 1.5);
    }
    for (let x = 0; x < 1024; x += 4) {
      ctx.fillRect(x, 0, 1.5, 1024);
    }

    // Flank panels
    ctx.fillStyle = secHex;
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.lineTo(200, 240);
    ctx.lineTo(170, 800);
    ctx.lineTo(0, 840);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(1024, 160);
    ctx.lineTo(824, 240);
    ctx.lineTo(854, 800);
    ctx.lineTo(1024, 840);
    ctx.closePath();
    ctx.fill();

    // Large Bold Team Branding across Shoulder Blades
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.font = '900 italic 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cfg.teamName, 514, 244); // Shadow

    ctx.fillStyle = '#ffffff';
    ctx.fillText(cfg.teamName, 512, 240);

    // Accent line under team banner
    ctx.strokeStyle = accHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(260, 270);
    ctx.lineTo(764, 270);
    ctx.stroke();

    // Secondary sponsor badge on lower back
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(362, 380, 300, 75);
    ctx.fillStyle = '#09090b';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(cfg.sponsorPrimary, 512, 430);

    // Waist Belt Back with Lumbar Elastic Accordion Ribs
    ctx.fillStyle = secHex;
    ctx.fillRect(160, 620, 704, 65);
    ctx.strokeStyle = accHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(160, 620, 704, 65);

    // Stretch Ribs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    for (let x = 380; x <= 644; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 625);
      ctx.lineTo(x, 680);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    this.suitBackTextures.set(cfg.teamId, texture);
    return texture;
  }

  /**
   * Builds an anatomically realistic, multi-layered 3D human mechanic with:
   * - Tailored Nomex fire suit with team colors and sponsor decals
   * - Composite FIA 8860-2018 racing helmet with iridescent visor, Stilo headset & HANS posts
   * - Articulated arms with deltoids, elbows, and racing gloves with palm grip and fingers
   * - Articulated biomechanical legs with heavy-duty Kevlar knee pads and racing boots
   * - Paoli DP 6000 pneumatic impact gun with overhead balancer harness
   */
  public static buildPhotorealisticMechanic(
    type: CrewRoleType,
    config: TeamMechanicVisualConfig,
    hasTwoBoneIK: boolean = true
  ): {
    proceduralBody: THREE.Group;
    pelvisGroup: THREE.Group;
    torsoGroup: THREE.Group;
    headGroup: THREE.Group;
    leftArmIK?: ArmIKJoints;
    rightArmIK?: ArmIKJoints;
    leftLeg?: LegJoints;
    rightLeg?: LegJoints;
    toolMesh?: THREE.Group;
    balancerHarness?: THREE.Group;
    balancerCable?: THREE.Line;
  } {
    const proceduralBody = new THREE.Group();
    proceduralBody.name = `HumanMechanic_${type}_${config.teamId}`;

    const mats = this.getTeamMaterials(config);
    const {
      suitFrontMat,
      suitBackMat,
      suitPrimaryMat,
      suitDarkMat,
      helmetShellMat,
      visorMat,
      rubberMat,
      metalMat,
      kevlarMat,
      accentMat,
      soleMat,
      radioPackMat,
      hansMat,
      headsetMat,
      socketMat,
      pulleyMat,
    } = mats;

    // =========================================================================
    // 1. ARTICULATED PELVIS & BIOMECHANICAL LEGS WITH KEVLAR KNEE PADS & BOOTS
    // =========================================================================
    const pelvisGroup = new THREE.Group();
    pelvisGroup.position.set(0, 0.72, 0);
    proceduralBody.add(pelvisGroup);

    // Pelvis anatomical saddle (connects hips, covers groin & rear)
    const pelvisGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.18, 12);
    pelvisGeo.scale(1.25, 1.0, 0.95);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, suitDarkMat);
    pelvisMesh.position.set(0, 0.02, 0);
    pelvisMesh.castShadow = false;
    pelvisGroup.add(pelvisMesh);

    const createAnatomicalLeg = (isRight: boolean): LegJoints => {
      const l1 = 0.36; // Femur / Thigh
      const l2 = 0.36; // Tibia / Shin
      const lx = isRight ? 0.135 : -0.135;

      const hip = new THREE.Group();
      hip.position.set(lx, 0, 0);
      pelvisGroup.add(hip);

      // 1. Contoured Thigh (tapers towards knee with quadriceps mass)
      const thighGroup = new THREE.Group();
      const thighGeo = new THREE.CylinderGeometry(0.082, 0.068, l1, 10);
      thighGeo.translate(0, -l1 / 2, 0);
      const thigh = new THREE.Mesh(thighGeo, suitPrimaryMat);
      thigh.castShadow = false;
      thighGroup.add(thigh);

      // Longitudinal contrast stripe on outer leg
      const legStripeGeo = new THREE.BoxGeometry(0.015, l1 * 0.92, 0.04);
      legStripeGeo.translate(isRight ? 0.075 : -0.075, -l1 / 2, 0);
      const legStripe = new THREE.Mesh(legStripeGeo, suitDarkMat);
      thighGroup.add(legStripe);
      hip.add(thighGroup);

      // 2. Knee Joint & Hexagonal Heavy-Duty Kevlar Kneepad
      const knee = new THREE.Group();
      knee.position.set(0, -l1, 0);
      hip.add(knee);

      const kneeGeo = new THREE.SphereGeometry(0.066, 10, 8);
      const kneeMesh = new THREE.Mesh(kneeGeo, suitDarkMat);
      knee.add(kneeMesh);

      // Padded hexagonal kevlar protector on front of knee
      const padGeo = new THREE.CylinderGeometry(0.062, 0.068, 0.10, 6);
      padGeo.rotateX(Math.PI / 2);
      const kneePad = new THREE.Mesh(padGeo, kevlarMat);
      kneePad.position.set(0, 0, 0.05);
      knee.add(kneePad);

      // 3. Shin / Tibia (tapers towards ankle with gastrocnemius calf curve)
      const shinGroup = new THREE.Group();
      const shinGeo = new THREE.CylinderGeometry(0.064, 0.054, l2, 10);
      shinGeo.translate(0, -l2 / 2, 0);
      const shin = new THREE.Mesh(shinGeo, suitPrimaryMat);
      shin.castShadow = false;
      shinGroup.add(shin);

      // Lower pant leg hem fold
      const cuffGeo = new THREE.TorusGeometry(0.056, 0.014, 6, 12);
      cuffGeo.rotateX(Math.PI / 2);
      const cuff = new THREE.Mesh(cuffGeo, suitDarkMat);
      cuff.position.set(0, -l2 + 0.04, 0);
      shinGroup.add(cuff);
      knee.add(shinGroup);

      // 4. Ankle & Ergonomic Motorsport Racing Boot
      const ankle = new THREE.Group();
      ankle.position.set(0, -l2, 0);
      knee.add(ankle);

      const bootGroup = new THREE.Group();

      // Ergonomic curved boot upper (Alpinestars F1 Tech 1-Z style)
      const upperGeo = new THREE.BoxGeometry(0.12, 0.12, 0.22);
      upperGeo.translate(0, 0.06, 0.03);
      const bootUpper = new THREE.Mesh(upperGeo, rubberMat);
      bootUpper.castShadow = false;
      bootGroup.add(bootUpper);

      // Sloped front toe cap
      const toeGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.11, 8, 1, false, 0, Math.PI);
      toeGeo.rotateZ(Math.PI / 2);
      const toe = new THREE.Mesh(toeGeo, rubberMat);
      toe.position.set(0, 0.03, 0.13);
      bootGroup.add(toe);

      // Thin high-grip rubber sole with rounded heel
      const soleGeo = new THREE.BoxGeometry(0.125, 0.024, 0.26);
      soleGeo.translate(0, 0.012, 0.04);
      const sole = new THREE.Mesh(soleGeo, soleMat);
      bootGroup.add(sole);

      // Ankle support strap with metallic buckle
      const strapGeo = new THREE.BoxGeometry(0.13, 0.025, 0.14);
      strapGeo.translate(0, 0.09, 0);
      const strap = new THREE.Mesh(strapGeo, accentMat);
      bootGroup.add(strap);

      ankle.add(bootGroup);

      return { hip, thigh, knee, shin, ankle, boot: bootUpper, l1, l2, isRight };
    };

    const leftLeg = createAnatomicalLeg(false);
    const rightLeg = createAnatomicalLeg(true);

    // =========================================================================
    // 2. ATHLETIC NOMEX TORSO WITH RESCUE EPAULETTES & LUMBAR RADIO PACK
    // =========================================================================
    const torsoGroup = new THREE.Group();
    pelvisGroup.add(torsoGroup);

    // Sculpted athletic torso with V-shape taper (wider at shoulders, tapered at waist)
    const torsoGeo = new THREE.BoxGeometry(0.48, 0.58, 0.27, 4, 6, 4);
    const pos = torsoGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Taper waist inward
      if (y < -0.1) {
        pos.setX(i, x * 0.88);
        pos.setZ(i, z * 0.92);
      }
      // Expand pectoral & latissimus width
      if (y > 0.08) {
        pos.setX(i, x * 1.08);
      }
    }
    torsoGeo.computeVertexNormals();

    // BoxGeometry Face Materials:
    // [0: +X Right, 1: -X Left, 2: +Y Top, 3: -Y Bottom, 4: +Z Front, 5: -Z Back]
    const torsoMaterials = [
      suitDarkMat,
      suitDarkMat,
      suitDarkMat,
      suitDarkMat,
      suitFrontMat,
      suitBackMat,
    ];
    const torsoMesh = new THREE.Mesh(torsoGeo, torsoMaterials);
    torsoMesh.position.set(0, 0.31, 0);
    torsoMesh.castShadow = false;
    torsoGroup.add(torsoMesh);

    // Mandarin Collar with Velcro Tab
    const collarGeo = new THREE.CylinderGeometry(0.12, 0.13, 0.08, 12);
    const collar = new THREE.Mesh(collarGeo, suitDarkMat);
    collar.position.set(0, 0.61, 0);
    torsoGroup.add(collar);

    // Shoulder Rescue Extraction Straps / Epaulettes (FIA compulsory feature)
    [-0.22, 0.22].forEach((sx) => {
      const epGeo = new THREE.BoxGeometry(0.08, 0.024, 0.22);
      const ep = new THREE.Mesh(epGeo, accentMat);
      ep.position.set(sx, 0.59, 0.02);
      ep.rotation.z = sx > 0 ? -0.15 : 0.15;
      torsoGroup.add(ep);
    });

    // Lumbar Telemetry Radio Battery Pack on back of belt
    const radioPackGeo = new THREE.BoxGeometry(0.15, 0.12, 0.06);
    const radioPack = new THREE.Mesh(radioPackGeo, radioPackMat);
    radioPack.position.set(0, 0.08, -0.15);
    torsoGroup.add(radioPack);

    // Stubby flexible antenna
    const antGeo = new THREE.CylinderGeometry(0.006, 0.008, 0.18, 6);
    const ant = new THREE.Mesh(antGeo, rubberMat);
    ant.position.set(0.05, 0.20, -0.15);
    torsoGroup.add(ant);

    // =========================================================================
    // 3. FIA 8860-2018 SPEC RACING HELMET WITH IRIDESCENT VISOR, HANS & HEADSET
    // =========================================================================
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.61, 0);
    torsoGroup.add(headGroup);

    // Muscular neck with Nomex balaclava
    const neckGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.10, 10);
    const neck = new THREE.Mesh(neckGeo, suitDarkMat);
    neck.position.set(0, 0.04, 0);
    headGroup.add(neck);

    // 1. Aerodynamic Helmet Shell with sculpted chin-bar, brow crest & rear spoiler
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0, 0.18, 0);

    const domeGeo = new THREE.SphereGeometry(0.165, 16, 14);
    domeGeo.scale(0.92, 1.05, 1.04);
    const dome = new THREE.Mesh(domeGeo, helmetShellMat);
    dome.castShadow = false;
    helmetGroup.add(dome);

    // Prominent angular chin-guard (Mentonera)
    const chinGeo = new THREE.BoxGeometry(0.18, 0.10, 0.12);
    chinGeo.translate(0, -0.06, 0.12);
    const chin = new THREE.Mesh(chinGeo, helmetShellMat);
    helmetGroup.add(chin);

    // Forehead aerodynamic gurney ridge
    const ridgeGeo = new THREE.BoxGeometry(0.15, 0.025, 0.06);
    ridgeGeo.translate(0, 0.11, 0.11);
    const ridge = new THREE.Mesh(ridgeGeo, helmetShellMat);
    helmetGroup.add(ridge);

    // Aerodynamic Rear Ducktail Fin / Polycarbonate Spoiler
    const spoilerGeo = new THREE.BoxGeometry(0.17, 0.03, 0.06);
    spoilerGeo.rotateX(-0.35);
    const spoiler = new THREE.Mesh(spoilerGeo, radioPackMat);
    spoiler.position.set(0, 0.10, -0.15);
    helmetGroup.add(spoiler);

    // FIA 8858 Anodized Red HANS Tether Anchor Posts on left and right lower rear
    [-0.145, 0.145].forEach((hx) => {
      const hansGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.02, 8);
      hansGeo.rotateZ(Math.PI / 2);
      const hansPost = new THREE.Mesh(hansGeo, hansMat);
      hansPost.position.set(hx, -0.02, -0.09);
      helmetGroup.add(hansPost);
    });

    // 2. High-Tech Iridescent Polarized Visor with Rubber Bezel
    const visorGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.085, 16, 1, true, -Math.PI * 0.36, Math.PI * 0.72);
    visorGeo.rotateY(-Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.02, 0.05);
    helmetGroup.add(visor);

    // Visor Brow Sunstrip Banner
    const sunstripGeo = new THREE.CylinderGeometry(0.162, 0.162, 0.022, 16, 1, true, -Math.PI * 0.35, Math.PI * 0.70);
    sunstripGeo.rotateY(-Math.PI / 2);
    const sunstrip = new THREE.Mesh(sunstripGeo, accentMat);
    sunstrip.position.set(0, 0.055, 0.05);
    helmetGroup.add(sunstrip);

    // Pivot screws (Anodized gold/alloy visor lock screws on left and right)
    [-0.155, 0.155].forEach((vx) => {
      const screwGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.01, 8);
      screwGeo.rotateZ(Math.PI / 2);
      const screw = new THREE.Mesh(screwGeo, metalMat);
      screw.position.set(vx, 0.02, 0.04);
      helmetGroup.add(screw);
    });

    // 3. Stilo / Peltor 110 dB Noise-Cancelling Intercom Headset
    [-0.152, 0.152].forEach((ex) => {
      const isRight = ex > 0;
      const cupGeo = new THREE.CylinderGeometry(0.042, 0.048, 0.045, 10);
      cupGeo.rotateZ(Math.PI / 2);
      const cup = new THREE.Mesh(cupGeo, headsetMat);
      cup.position.set(ex, 0.01, -0.02);
      helmetGroup.add(cup);

      // Foam ear seal ring
      const sealGeo = new THREE.TorusGeometry(0.045, 0.01, 6, 10);
      sealGeo.rotateY(Math.PI / 2);
      const seal = new THREE.Mesh(sealGeo, rubberMat);
      seal.position.set(ex + (isRight ? -0.015 : 0.015), 0.01, -0.02);
      helmetGroup.add(seal);
    });

    // Flexible Gooseneck Boom Microphone curving to the mouth
    const micArmGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.16, 6);
    micArmGeo.rotateZ(Math.PI / 3);
    const micArm = new THREE.Mesh(micArmGeo, metalMat);
    micArm.position.set(-0.11, -0.04, 0.09);
    helmetGroup.add(micArm);

    const micTipGeo = new THREE.SphereGeometry(0.014, 6, 6);
    const micTip = new THREE.Mesh(micTipGeo, rubberMat);
    micTip.position.set(-0.04, -0.06, 0.16);
    helmetGroup.add(micTip);

    headGroup.add(helmetGroup);

    // =========================================================================
    // 4. ARTICULATED ARMS WITH MOTORSPORT GLOVES & SILICONE PALM PADS
    // =========================================================================
    const createAnatomicalArm = (isRight: boolean): ArmIKJoints => {
      const l1 = 0.28;
      const l2 = 0.26;
      const sx = isRight ? 0.25 : -0.25;

      const shoulderGroup = new THREE.Group();
      shoulderGroup.position.set(sx, 0.48, 0.03);

      // Deltoid muscular cap
      const deltGeo = new THREE.SphereGeometry(0.072, 8, 8);
      const delt = new THREE.Mesh(deltGeo, suitDarkMat);
      shoulderGroup.add(delt);

      // Biceps & Triceps (tapered contoured arm)
      const upperGeo = new THREE.CylinderGeometry(0.058, 0.048, l1, 10);
      upperGeo.translate(0, -l1 / 2, 0);
      const upperArm = new THREE.Mesh(upperGeo, suitPrimaryMat);
      upperArm.castShadow = false;
      shoulderGroup.add(upperArm);

      // Elbow Joint
      const elbowGroup = new THREE.Group();
      elbowGroup.position.set(0, -l1, 0);

      const elbowCapGeo = new THREE.SphereGeometry(0.054, 8, 8);
      const elbowCap = new THREE.Mesh(elbowCapGeo, suitDarkMat);
      elbowGroup.add(elbowCap);

      // Forearm with fabric wrinkle curves
      const foreGeo = new THREE.CylinderGeometry(0.049, 0.042, l2, 10);
      foreGeo.translate(0, -l2 / 2, 0);
      const forearm = new THREE.Mesh(foreGeo, suitPrimaryMat);
      forearm.castShadow = false;
      elbowGroup.add(forearm);

      // Wrist cuff elastic ring
      const cuffGeo = new THREE.TorusGeometry(0.044, 0.012, 6, 12);
      cuffGeo.rotateX(Math.PI / 2);
      const cuff = new THREE.Mesh(cuffGeo, suitDarkMat);
      cuff.position.set(0, -l2 + 0.03, 0);
      elbowGroup.add(cuff);

      // Hand & Professional Motorsport Glove with Curved Fingers
      const handGroup = new THREE.Group();
      handGroup.position.set(0, -l2, 0);

      const gloveGroup = new THREE.Group();

      // Main palm
      const palmGeo = new THREE.BoxGeometry(0.082, 0.075, 0.042);
      palmGeo.translate(0, -0.038, 0.01);
      const palm = new THREE.Mesh(palmGeo, suitDarkMat);
      gloveGroup.add(palm);

      // Silicone grip pad on inner palm
      const padGeo = new THREE.BoxGeometry(0.07, 0.06, 0.01);
      padGeo.translate(0, -0.038, 0.032);
      const pad = new THREE.Mesh(padGeo, accentMat);
      gloveGroup.add(pad);

      // Anatomical Thumb
      const thumbGeo = new THREE.CylinderGeometry(0.014, 0.012, 0.045, 6);
      thumbGeo.rotateZ(isRight ? -0.55 : 0.55);
      const thumb = new THREE.Mesh(thumbGeo, suitDarkMat);
      thumb.position.set(isRight ? 0.048 : -0.048, -0.025, 0.02);
      gloveGroup.add(thumb);

      // Curved gripping fingers
      const fingersGeo = new THREE.CylinderGeometry(0.038, 0.036, 0.065, 8);
      fingersGeo.rotateZ(Math.PI / 2);
      fingersGeo.rotateX(0.45);
      const fingers = new THREE.Mesh(fingersGeo, suitDarkMat);
      fingers.position.set(0, -0.08, 0.02);
      gloveGroup.add(fingers);

      handGroup.add(gloveGroup);
      elbowGroup.add(handGroup);
      shoulderGroup.add(elbowGroup);
      torsoGroup.add(shoulderGroup);

      return {
        shoulder: shoulderGroup,
        upperArm,
        elbow: elbowGroup,
        forearm,
        hand: handGroup,
        l1,
        l2,
        isRight,
      };
    };

    const leftArmIK: ArmIKJoints = createAnatomicalArm(false);
    const rightArmIK: ArmIKJoints = createAnatomicalArm(true);

    let toolMesh: THREE.Group | undefined;
    let balancerHarness: THREE.Group | undefined;
    let balancerCable: THREE.Line | undefined;

    // Tool creation for tyre technicians
    const isTyreTech = type.startsWith('tyre_tech');
    if (isTyreTech) {
      const gunGroup = new THREE.Group();

      // Paoli DP 6000 Pneumatic Impact Wrench Housing (Alloy Gun Body)
      const gunBodyGeo = new THREE.CylinderGeometry(0.046, 0.058, 0.28, 12);
      gunBodyGeo.rotateX(Math.PI / 2);
      const gunBody = new THREE.Mesh(gunBodyGeo, metalMat);
      gunGroup.add(gunBody);

      // Deep impact socket with magnetic retention ring
      const socketGeo = new THREE.CylinderGeometry(0.038, 0.044, 0.14, 10);
      socketGeo.rotateX(Math.PI / 2);
      const socket = new THREE.Mesh(socketGeo, socketMat);
      socket.position.set(0, 0, 0.20);
      gunGroup.add(socket);

      // Ergonomic pistol grip with finger grooves
      const gripGeo = new THREE.BoxGeometry(0.035, 0.16, 0.05);
      gripGeo.rotateX(-0.15);
      const grip = new THREE.Mesh(gripGeo, rubberMat);
      grip.position.set(0, -0.12, -0.04);
      gunGroup.add(grip);

      // Top eyelet for tool balancer cable
      const eyeletGeo = new THREE.TorusGeometry(0.025, 0.006, 6, 12);
      const eyelet = new THREE.Mesh(eyeletGeo, metalMat);
      eyelet.position.set(0, 0.075, 0.02);
      gunGroup.add(eyelet);

      // Rapid nitrogen decompression exhaust port
      const exhaustGeo = new THREE.CylinderGeometry(0.016, 0.02, 0.06, 8);
      exhaustGeo.rotateX(-Math.PI / 3);
      const exhaust = new THREE.Mesh(exhaustGeo, metalMat);
      exhaust.position.set(0, -0.06, -0.14);
      gunGroup.add(exhaust);

      // Overhead Tool Balancer Rig with Retractable Coiled Cable
      balancerHarness = new THREE.Group();
      const pulleyGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 12);
      const pulley = new THREE.Mesh(pulleyGeo, pulleyMat);
      pulley.position.set(0, 3.4, 0);
      balancerHarness.add(pulley);

      const cableGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 3.4, 0),
        new THREE.Vector3(0, 1.0, 0),
      ]);
      const cableMat = new THREE.LineBasicMaterial({ color: 0x94a3b8 });
      balancerCable = new THREE.Line(cableGeo, cableMat);
      balancerHarness.add(balancerCable);
      proceduralBody.add(balancerHarness);

      toolMesh = gunGroup;
      proceduralBody.add(gunGroup);
    }

    // Default static pose if IK is not driving arms dynamically every frame
    if (!hasTwoBoneIK) {
      if (type === 'front_jack' || type === 'rear_jack') {
        // Holding jack trolley handle forward-down
        leftArmIK.shoulder.rotation.set(-0.62, 0.12, -0.08);
        leftArmIK.elbow.rotation.set(0.68, 0, 0);
        rightArmIK.shoulder.rotation.set(-0.62, -0.12, 0.08);
        rightArmIK.elbow.rotation.set(0.68, 0, 0);
      } else if (type === 'lollipop') {
        // Left arm raising lollipop sign pole, right arm relaxed at hip
        leftArmIK.shoulder.rotation.set(-1.15, 0.22, 0.05);
        leftArmIK.elbow.rotation.set(0.45, 0, 0);
        rightArmIK.shoulder.rotation.set(-0.25, -0.08, 0.1);
        rightArmIK.elbow.rotation.set(0.35, 0, 0);
      } else if (isTyreTech) {
        // In tyre stance, holding wheel gun at spindle height
        leftArmIK.shoulder.rotation.set(-0.72, 0.30, 0);
        leftArmIK.elbow.rotation.set(1.05, 0, 0);
        rightArmIK.shoulder.rotation.set(-0.68, -0.28, 0);
        rightArmIK.elbow.rotation.set(0.92, 0, 0);
        if (toolMesh) {
          toolMesh.position.set(0, 0.32, 0.40);
        }
      } else {
        // Ready athletic standby
        leftArmIK.shoulder.rotation.set(-0.30, 0.10, 0);
        leftArmIK.elbow.rotation.set(0.42, 0, 0);
        rightArmIK.shoulder.rotation.set(-0.30, -0.10, 0);
        rightArmIK.elbow.rotation.set(0.42, 0, 0);
      }
    }

    return {
      proceduralBody,
      pelvisGroup,
      torsoGroup,
      headGroup,
      leftArmIK,
      rightArmIK,
      leftLeg,
      rightLeg,
      toolMesh,
      balancerHarness,
      balancerCable,
    };
  }

  /**
   * Poses an anatomically realistic static mechanic in race-ready stances:
   * - isCrouched: athletic racing squat, angled knees with kevlar pad compression, forward spine lean
   * - hasGun: firmly gripping the Paoli pneumatic impact gun with both hands
   */
  public static poseStaticMechanic(
    built: ReturnType<typeof HumanCrewMeshBuilder.buildPhotorealisticMechanic>,
    role: CrewRoleType,
    isCrouched: boolean = false,
    hasGun: boolean = false
  ): void {
    if (isCrouched && built.leftLeg && built.rightLeg) {
      built.pelvisGroup.position.y = 0.46;
      built.torsoGroup.rotation.x = 0.38;
      built.headGroup.rotation.x = -0.22;

      // Closed-form biomechanical squat angles
      built.leftLeg.hip.rotation.x = -0.85;
      built.leftLeg.knee.rotation.x = 1.62;
      built.leftLeg.ankle.rotation.x = -0.77;

      built.rightLeg.hip.rotation.x = -0.85;
      built.rightLeg.knee.rotation.x = 1.62;
      built.rightLeg.ankle.rotation.x = -0.77;
    }

    if (hasGun && built.toolMesh && built.leftArmIK && built.rightArmIK) {
      built.leftArmIK.shoulder.rotation.set(-0.75, 0.35, 0);
      built.leftArmIK.elbow.rotation.set(1.10, 0, 0);
      built.rightArmIK.shoulder.rotation.set(-0.70, -0.30, 0);
      built.rightArmIK.elbow.rotation.set(0.95, 0, 0);

      const py = built.pelvisGroup.position.y;
      built.toolMesh.position.set(0, py + 0.30, 0.42);
      built.toolMesh.rotation.set(0, 0, 0);
    }
  }

  private static refCount = 0;

  public static acquire(): void {
    this.refCount++;
  }

  public static release(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) {
      this.disposeCaches();
    }
  }

  /**
   * Explicitly flush and dispose static textures and materials for human crew mechanics
   */
  public static disposeCaches(): void {
    this.suitFrontTextures.forEach((tex) => {
      if (tex && typeof tex.dispose === 'function') tex.dispose();
    });
    this.suitFrontTextures.clear();

    this.suitBackTextures.forEach((tex) => {
      if (tex && typeof tex.dispose === 'function') tex.dispose();
    });
    this.suitBackTextures.clear();

    this.teamMaterialsMap.forEach((mats) => {
      Object.values(mats).forEach((mat) => {
        if (mat && typeof mat.dispose === 'function') {
          mat.dispose();
        }
      });
    });
    this.teamMaterialsMap.clear();
  }
}
