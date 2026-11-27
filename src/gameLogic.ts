export const WATER = -0.60;
export const WORLD_LIMIT = 335;
export const WORLD_SPAWN_LIMIT = 315;
export const LAKE_X = 95.0;
export const LAKE_Z = -115.0;
export const LAKE_R = 39.0;

export interface HighCanopyZone {
  x: number;
  z: number;
  radius: number;
  pondX: number;
  pondZ: number;
  pondRadius: number;
}

export const HIGH_CANOPY_ZONES: HighCanopyZone[] = [
  { x: -120, z: -70, radius: 46, pondX: -124, pondZ: -66, pondRadius: 11.5 },
  { x: 135, z: 75, radius: 50, pondX: 130, pondZ: 80, pondRadius: 12.5 },
  { x: -105, z: 135, radius: 44, pondX: -100, pondZ: 130, pondRadius: 10.5 },
  { x: 120, z: -150, radius: 44, pondX: 115, pondZ: -146, pondRadius: 10.8 },
  { x: -210, z: 25, radius: 48, pondX: -205, pondZ: 28, pondRadius: 12.0 },
];

export interface CaveZone {
  name: string;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  radius: number;
  isDeadEnd: boolean;
  entranceY: number;
  floorY: number;
}

export const CAVE_ZONES: CaveZone[] = [
  { name: 'Hang Đá Ngầm Sông Lớn', startX: -140, startZ: 30, endX: -34, endZ: 22, radius: 13.5, isDeadEnd: false, entranceY: 2.2, floorY: -3.2 },
  { name: 'Hang Tối Đông Bắc (Ngõ Cụt)', startX: 145, startZ: -25, endX: 192, endZ: -52, radius: 13.5, isDeadEnd: true, entranceY: 2.4, floorY: -3.4 },
  { name: 'Đường Hầm Thông Hồ Nam', startX: 150, startZ: 145, endX: 104, endZ: -74, radius: 13.0, isDeadEnd: false, entranceY: 1.8, floorY: -3.1 },
];

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function riverX(z: number): number {
  return Math.sin(z * 0.018) * 32 + Math.cos(z * 0.009) * 14;
}

export function tributaryZ(x: number): number {
  return 55.0 + Math.sin(x * 0.022) * 20.0;
}

export function isActualWaterBodyAt(x: number, z: number, extraMargin = 2.5): boolean {
  const rx = riverX(z);
  if (Math.abs(x - rx) <= 28.0 + extraMargin) return true;
  if (x < rx + 10.0) {
    const tz = tributaryZ(x);
    if (Math.abs(z - tz) <= 13.5 + extraMargin) return true;
  }
  if (Math.hypot(x - LAKE_X, z - LAKE_Z) <= LAKE_R + extraMargin) return true;
  for (let i = 0; i < HIGH_CANOPY_ZONES.length; i++) {
    const cz = HIGH_CANOPY_ZONES[i];
    if (Math.hypot(x - cz.pondX, z - cz.pondZ) <= cz.pondRadius + extraMargin) return true;
  }
  return false;
}

export function computeCaveInfluence(x: number, z: number): {
  inCave: boolean;
  cave: CaveZone | null;
  floorY: number;
  ceilingY: number;
  blend: number;
  distRatio: number;
  t: number;
} {
  for (let i = 0; i < CAVE_ZONES.length; i++) {
    const c = CAVE_ZONES[i];
    const vx = c.endX - c.startX;
    const vz = c.endZ - c.startZ;
    const lenSq = vx * vx + vz * vz;
    let t = ((x - c.startX) * vx + (z - c.startZ) * vz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = c.startX + t * vx;
    const projZ = c.startZ + t * vz;
    const dist = Math.hypot(x - projX, z - projZ);
    if (dist < c.radius * 1.35) {
      const distRatio = dist / c.radius;
      const crossBlend = 1.0 - smoothstep(0.55, 1.25, distRatio);
      const entryRamp = smoothstep(0.0, 0.24, t);
      const exitRamp = c.isDeadEnd ? 1.0 : smoothstep(0.0, 0.24, 1.0 - t);
      const depthFactor = entryRamp * exitRamp;
      const targetFloorY = c.entranceY * (1.0 - depthFactor) + c.floorY * depthFactor;
      const targetCeilY = targetFloorY + 4.8;
      return {
        inCave: distRatio < 0.92 && t > 0.05 && (c.isDeadEnd ? t < 0.98 : t < 0.95),
        cave: c,
        floorY: targetFloorY,
        ceilingY: targetCeilY,
        blend: crossBlend,
        distRatio,
        t,
      };
    }
  }
  return { inCave: false, cave: null, floorY: 0, ceilingY: 999, blend: 0, distRatio: 999, t: 0 };
}

export function isPointInCave(x: number, z: number): CaveZone | null {
  const info = computeCaveInfluence(x, z);
  return info.inCave ? info.cave : null;
}

export function canOwlTakeoffOnSecondSpace(
  species: string,
  isFlying: boolean,
  isConstricted: boolean,
  timeSinceLastSpaceMs: number,
  isGrounded: boolean
): boolean {
  if (species !== 'owl' || isFlying || isConstricted) return false;
  return (timeSinceLastSpaceMs > 25 && timeSinceLastSpaceMs <= 650) || !isGrounded;
}

export function shouldHideWaterRipplesInDeepWater(
  underwaterBlend: number,
  isDiving: boolean,
  playerDepthBelowSurface: number
): boolean {
  return underwaterBlend > 0.08 || isDiving || playerDepthBelowSurface > 0.72;
}

export function computeCrocodileDiveVelocityY(
  isDiving: boolean,
  inWater: boolean,
  inputZ: number,
  camPitch: number,
  speed: number,
  spacePressed: boolean,
  cPressed: boolean
): number {
  if (!isDiving || !inWater) return 0;
  const pitchSin = -Math.sin(camPitch);
  let diveVy = 0;
  if (inputZ !== 0) {
    diveVy += inputZ * pitchSin * speed * 0.95;
  }
  if (spacePressed) diveVy += 4.2;
  if (cPressed) diveVy -= 4.2;
  return diveVy;
}

export function computeTigerCamouflageState(
  currentGauge: number,
  dt: number,
  isSneaking: boolean,
  isConstricted: boolean,
  isAttackingOrPinning: boolean
): { gauge: number; isCamouflaged: boolean; opacity: number } {
  if (isSneaking && !isConstricted && !isAttackingOrPinning) {
    const nextGauge = Math.min(5.0, currentGauge + dt);
    if (nextGauge >= 5.0) {
      return { gauge: 5.0, isCamouflaged: true, opacity: 0.25 };
    }
    return {
      gauge: nextGauge,
      isCamouflaged: false,
      opacity: 1.0 - (nextGauge / 5.0) * 0.45,
    };
  }
  return { gauge: 0, isCamouflaged: false, opacity: 1.0 };
}

export function canTigerRoarStunSpecies(species: string): boolean {
  return species !== 'anaconda' && species !== 'crocodile';
}

export interface Obstacle2D {
  x: number;
  z: number;
  radius: number;
}

export function hasClearLineOfSight2D(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  obstacles: Obstacle2D[],
  entityRadius = 0.55
): boolean {
  const vx = x2 - x1;
  const vz = z2 - z1;
  const segLenSq = vx * vx + vz * vz;
  if (segLenSq < 0.0001) return true;

  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const t = Math.max(0, Math.min(1, ((obs.x - x1) * vx + (obs.z - z1) * vz) / segLenSq));
    const projX = x1 + t * vx;
    const projZ = z1 + t * vz;
    const dx = obs.x - projX;
    const dz = obs.z - projZ;
    const minClear = obs.radius + entityRadius;
    if (dx * dx + dz * dz < minClear * minClear) {
      return false;
    }
  }
  return true;
}

export function computeNavWaypointAroundObstacles(
  x: number,
  z: number,
  desiredYaw: number,
  lookAheadDist: number,
  obstacles: Obstacle2D[],
  entityRadius = 0.55,
  preferredSide = 1
): { yaw: number; waypointX: number; waypointZ: number; steered: boolean; chosenSide: number } {
  const directX = x + Math.sin(desiredYaw) * lookAheadDist;
  const directZ = z + Math.cos(desiredYaw) * lookAheadDist;

  if (hasClearLineOfSight2D(x, z, directX, directZ, obstacles, entityRadius)) {
    return {
      yaw: desiredYaw,
      waypointX: directX,
      waypointZ: directZ,
      steered: false,
      chosenSide: preferredSide,
    };
  }

  // Candidate deflection angles in radians (prioritizing preferredSide first to prevent left-right oscillation)
  const angleMagnitudes = [0.42, 0.78, 1.15, 1.52, 1.95, 2.45];
  const sideOrder = preferredSide >= 0 ? [1, -1] : [-1, 1];

  for (let a = 0; a < angleMagnitudes.length; a++) {
    const mag = angleMagnitudes[a];
    for (let s = 0; s < sideOrder.length; s++) {
      const side = sideOrder[s];
      const candYaw = desiredYaw + side * mag;
      const candX = x + Math.sin(candYaw) * lookAheadDist;
      const candZ = z + Math.cos(candYaw) * lookAheadDist;
      if (hasClearLineOfSight2D(x, z, candX, candZ, obstacles, entityRadius)) {
        return {
          yaw: candYaw,
          waypointX: candX,
          waypointZ: candZ,
          steered: true,
          chosenSide: side,
        };
      }
    }
  }

  // Fallback reverse-diagonal escape if completely surrounded
  const escapeYaw = desiredYaw + preferredSide * Math.PI * 0.85;
  return {
    yaw: escapeYaw,
    waypointX: x + Math.sin(escapeYaw) * lookAheadDist,
    waypointZ: z + Math.cos(escapeYaw) * lookAheadDist,
    steered: true,
    chosenSide: preferredSide,
  };
}

export function computeSemiAquaticVerticalSwimming(params: {
  species: string;
  currentY: number;
  groundY: number;
  isDiving: boolean;
  diveTargetY: number | null;
  inputZ: number;
  camPitch: number;
  speed: number;
  spacePressed: boolean;
  cPressed: boolean;
  dt: number;
}): { nextY: number; isDiving: boolean; diveTargetY: number | null; surfacedNow: boolean; doveNow: boolean } {
  const { species, currentY, groundY, inputZ, camPitch, speed, spacePressed, cPressed, dt } = params;
  let { isDiving, diveTargetY } = params;
  const waterDepth = WATER - groundY;
  const normalDraft = species === 'crocodile' ? 0.26 : 0.18;
  let surfacedNow = false;
  let doveNow = false;

  if (waterDepth < 0.40) {
    if (isDiving) surfacedNow = true;
    isDiving = false;
    diveTargetY = null;
  } else if (!isDiving) {
    // Allow both Crocodile and Anaconda to dive down into deep water using C/Ctrl or by pitching camera down while swimming forward
    const wantsCameraDive = inputZ > 0 && camPitch > 0.24 && waterDepth >= 0.65;
    if ((cPressed || wantsCameraDive) && waterDepth >= 0.45) {
      isDiving = true;
      doveNow = true;
      diveTargetY = Math.max(groundY + 0.18, Math.min(WATER - 0.45, currentY - 0.55));
    }
  }

  if (isDiving) {
    if (diveTargetY === null || diveTargetY === undefined) {
      diveTargetY = Math.max(groundY + 0.20, Math.min(WATER - 0.42, currentY - 0.6));
    }
    const pitchSin = -Math.sin(camPitch);
    let diveVy = 0;
    if (inputZ !== 0) {
      diveVy += inputZ * pitchSin * speed * 0.95;
    }
    if (spacePressed) diveVy += 4.5;
    if (cPressed) diveVy -= 4.5;

    diveTargetY += diveVy * dt;
    const minDiveY = groundY + 0.18;
    const maxDiveY = Math.max(minDiveY + 0.05, WATER - 0.16);
    diveTargetY = Math.max(minDiveY, Math.min(maxDiveY, diveTargetY));

    // If player actively swims upward (Space or looking up + W) and reaches near the water surface, smoothly surface!
    const wantsAscend = spacePressed || (inputZ !== 0 && inputZ * pitchSin > 0.18);
    if (wantsAscend && diveTargetY >= WATER - 0.26) {
      isDiving = false;
      diveTargetY = null;
      surfacedNow = true;
      const surfaceY = Math.max(groundY + 0.15, WATER - normalDraft);
      const nextY = currentY + (surfaceY - currentY) * Math.min(1, dt * 8.0);
      return { nextY, isDiving, diveTargetY, surfacedNow, doveNow };
    }

    const nextY = Math.max(minDiveY, Math.min(maxDiveY, currentY + (diveTargetY - currentY) * Math.min(1, dt * 8.0)));
    return { nextY, isDiving, diveTargetY, surfacedNow, doveNow };
  }

  const maxSafeDraft = Math.max(0.08, waterDepth - 0.22);
  const actualDraft = Math.min(normalDraft, maxSafeDraft);
  const targetY = WATER - actualDraft;
  const nextY = Math.max(groundY + 0.15, currentY + (targetY - currentY) * Math.min(1, dt * 6.5));
  return { nextY, isDiving: false, diveTargetY: null, surfacedNow, doveNow };
}

export function canAquaticPredatorStrikeAtShoreline(
  predX: number,
  predY: number,
  predZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  maxHorizRange: number,
  maxVertTolerance = 3.8
): boolean {
  const horizDist = Math.hypot(targetX - predX, targetZ - predZ);
  const vertDist = Math.abs(targetY - predY);
  return horizDist <= maxHorizRange && vertDist <= maxVertTolerance;
}

export const GRAVITY = -22.0;

export function computeGravityStep(
  currentY: number,
  velY: number,
  groundY: number,
  dt: number,
  gravity = GRAVITY
): {
  nextY: number;
  nextVelY: number;
  isGrounded: boolean;
  landedImpactSpeed: number;
} {
  const wasAirborne = currentY > groundY + 0.05 || velY > 0.05;
  const acceleratedVelY = Math.max(-48.0, velY + gravity * dt);
  const candidateY = currentY + acceleratedVelY * dt;

  if (candidateY <= groundY + 0.015 && acceleratedVelY <= 0) {
    return {
      nextY: groundY,
      nextVelY: 0,
      isGrounded: true,
      landedImpactSpeed: wasAirborne ? Math.abs(acceleratedVelY) : 0,
    };
  }

  return {
    nextY: candidateY,
    nextVelY: acceleratedVelY,
    isGrounded: false,
    landedImpactSpeed: 0,
  };
}

export interface LunarCycleState {
  dayIndex: number;
  phase: number; // 0.0 = New Moon, 0.5 = Full Moon
  illumination: number; // 0.0 (New Moon darkness) .. 1.0 (Full Moon brightness)
  phaseKey:
    | 'new_moon'
    | 'waxing_crescent'
    | 'first_quarter'
    | 'waxing_gibbous'
    | 'full_moon'
    | 'waning_gibbous'
    | 'last_quarter'
    | 'waning_crescent';
  phaseNameVi: string;
  phaseNameEn: string;
  phaseIcon: string;
  nightMoonLightIntensity: number;
  nightAmbientIntensity: number;
}

export function computeLunarCycleState(
  gameTime: number,
  dayDuration = 240,
  overridePhase: number | null = null
): LunarCycleState {
  const cycleDays = 8;
  const dayFloat = Math.max(0, gameTime / Math.max(1, dayDuration));
  const dayIndex = Math.floor(dayFloat) + 1;
  const rawPhase =
    overridePhase !== null && overridePhase !== undefined
      ? ((overridePhase % 1) + 1) % 1
      : ((dayFloat % cycleDays) / cycleDays + 1) % 1;

  // Illumination peaks at 1.0 when phase === 0.5 (Full Moon) and drops to 0.0 at phase === 0.0 (New Moon)
  const illumination = Math.max(0, Math.min(1, 0.5 * (1 - Math.cos(rawPhase * Math.PI * 2))));

  const bucket = Math.floor(((rawPhase + 1 / 16) % 1) * 8);
  const phases: Array<{
    key: LunarCycleState['phaseKey'];
    vi: string;
    en: string;
    icon: string;
  }> = [
    { key: 'new_moon', vi: 'Trăng Non', en: 'New Moon', icon: '🌑' },
    { key: 'waxing_crescent', vi: 'Trăng Lưỡi Liềm Đầu', en: 'Waxing Crescent', icon: '🌒' },
    { key: 'first_quarter', vi: 'Bán Nguyệt Đầu', en: 'First Quarter', icon: '🌓' },
    { key: 'waxing_gibbous', vi: 'Trăng Khuyết Đầu', en: 'Waxing Gibbous', icon: '🌔' },
    { key: 'full_moon', vi: 'Trăng Tròn', en: 'Full Moon', icon: '🌕' },
    { key: 'waning_gibbous', vi: 'Trăng Khuyết Cuối', en: 'Waning Gibbous', icon: '🌖' },
    { key: 'last_quarter', vi: 'Bán Nguyệt Cuối', en: 'Last Quarter', icon: '🌗' },
    { key: 'waning_crescent', vi: 'Trăng Lưỡi Liềm Cuối', en: 'Waning Crescent', icon: '🌘' },
  ];

  const meta = phases[bucket] || phases[0];

  // New Moon keeps the night genuinely dark; Full Moon provides subtle silvery-blue illumination
  const nightMoonLightIntensity = Number((0.02 + illumination * 0.46).toFixed(4));
  const nightAmbientIntensity = Number((0.07 + illumination * 0.27).toFixed(4));

  return {
    dayIndex,
    phase: rawPhase,
    illumination,
    phaseKey: meta.key,
    phaseNameVi: meta.vi,
    phaseNameEn: meta.en,
    phaseIcon: meta.icon,
    nightMoonLightIntensity,
    nightAmbientIntensity,
  };
}

export interface WindState {
  angle: number;
  dirX: number;
  dirZ: number;
  speed: number;
  strength: number;
  gustFactor: number;
  directionLabel: string;
}

export function computeWindState(time: number, baseAngle = 0.62, baseSpeed = 4.5): WindState {
  const angle = baseAngle + Math.sin(time * 0.07) * 0.38 + Math.cos(time * 0.03) * 0.22;
  const gustWave = 0.5 + 0.5 * Math.sin(time * 0.45) * Math.cos(time * 0.19);
  const speed = baseSpeed + gustWave * 4.2 + Math.sin(time * 1.1) * 0.85;
  const strength = Math.max(0.25, Math.min(2.2, speed / 4.8));
  const dirX = Math.cos(angle);
  const dirZ = Math.sin(angle);

  const dirs = ['Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc', 'Bắc', 'Đông Bắc'];
  const normAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const dirIdx = Math.round((normAngle / (Math.PI * 2)) * 8) % 8;

  return {
    angle,
    dirX,
    dirZ,
    speed: Number(speed.toFixed(1)),
    strength: Number(strength.toFixed(3)),
    gustFactor: Number(gustWave.toFixed(3)),
    directionLabel: dirs[dirIdx],
  };
}

export const LIFESPAN_SECONDS = 900; // 15 minutes full lifecycle

export interface SpeciesWeightProfile {
  baseYoungWeight: number;
  idealMaxWeight: number;
  minReproductionWeight: number; // 70% of idealMaxWeight
  reproductionType: 'egg' | 'baby';
  nestBiomassCost: number;
}

export const SPECIES_WEIGHT_PROFILES: Record<string, SpeciesWeightProfile> = {
  deer: { baseYoungWeight: 18, idealMaxWeight: 120, minReproductionWeight: 84, reproductionType: 'baby', nestBiomassCost: 15 },
  crocodile: { baseYoungWeight: 45, idealMaxWeight: 420, minReproductionWeight: 294, reproductionType: 'egg', nestBiomassCost: 40 },
  eagle: { baseYoungWeight: 1.4, idealMaxWeight: 8.0, minReproductionWeight: 5.6, reproductionType: 'egg', nestBiomassCost: 2 },
  wolf: { baseYoungWeight: 11, idealMaxWeight: 65, minReproductionWeight: 45.5, reproductionType: 'baby', nestBiomassCost: 10 },
  snake: { baseYoungWeight: 2.5, idealMaxWeight: 16, minReproductionWeight: 11.2, reproductionType: 'egg', nestBiomassCost: 3 },
  anaconda: { baseYoungWeight: 32, idealMaxWeight: 250, minReproductionWeight: 175, reproductionType: 'baby', nestBiomassCost: 30 },
  owl: { baseYoungWeight: 0.9, idealMaxWeight: 4.5, minReproductionWeight: 3.15, reproductionType: 'egg', nestBiomassCost: 1.5 },
  tiger: { baseYoungWeight: 38, idealMaxWeight: 280, minReproductionWeight: 196, reproductionType: 'baby', nestBiomassCost: 35 },
  jaguar: { baseYoungWeight: 24, idealMaxWeight: 135, minReproductionWeight: 94.5, reproductionType: 'baby', nestBiomassCost: 22 },
  capybara: { baseYoungWeight: 10, idealMaxWeight: 55, minReproductionWeight: 38.5, reproductionType: 'baby', nestBiomassCost: 8 },
  rabbit: { baseYoungWeight: 0.6, idealMaxWeight: 3.2, minReproductionWeight: 2.24, reproductionType: 'baby', nestBiomassCost: 1 },
  rat: { baseYoungWeight: 0.25, idealMaxWeight: 0.9, minReproductionWeight: 0.63, reproductionType: 'baby', nestBiomassCost: 0.3 },
  fish: { baseYoungWeight: 0.35, idealMaxWeight: 1.6, minReproductionWeight: 1.12, reproductionType: 'egg', nestBiomassCost: 0.4 },
};

export function getSpeciesWeightProfile(species: string): SpeciesWeightProfile {
  return SPECIES_WEIGHT_PROFILES[species] || SPECIES_WEIGHT_PROFILES.deer;
}

export type ThermalRegulationType = 'endotherm' | 'ectotherm';

export interface SpeciesThermalProfile {
  thermalType: ThermalRegulationType;
  bodyTempTarget: number;
  tMin: number;
  tOptLow: number;
  tOptHigh: number;
  tMax: number;
  tnzLow: number;
  tnzHigh: number;
  baseBmrPerSec: number;
  q10: number;
  refTemp: number;
  insulationFactor: number;
}

export const PHYSIOLOGY_CONFIG = {
  heatExchange: {
    airBaseExchangeRate: 0.14,
    waterExchangeMultiplier: 18.0, // Water conducts heat 18x faster than air (within 10-25x range)
    massExponent: 0.33, // Larger mass -> slower temperature change (mass^-0.33)
    juvenileExchangeMultiplier: 1.45, // Young animals change temperature faster than adults
    baskingExchangeMultiplier: 1.55, // Flattening posture absorbs solar heat faster
    crouchingExchangeMultiplier: 0.62, // Curling/crouching when cold reduces heat loss
    rainWetExchangeMultiplier: 1.5, // Wet fur/skin loses heat faster
    windExchangeFactorPerMs: 0.08, // Wind increases convective heat transfer
  },
  microclimate: {
    directSunBonusC: 5.5, // +5.5°C when standing in direct sun during daytime
    baskingPostureBonusC: 3.8, // Additional +3.8°C solar absorption when actively basking
    shadeOrCanopyOffsetC: -3.2, // -3.2°C under dense canopy, bushes, or caves
    rainOffsetC: -2.8, // Rain cools effective air temperature
    windChillFactorC: 0.25, // Wind chill per m/s when air is cool
    afternoonGroundWarmthC: 2.0, // Warm ground radiation in late afternoon
    sprintingMetabolicHeatC: 1.4, // Muscular heat generation when sprinting
    shallowWaterDayBonusC: 2.4, // Shallow water warms up faster under sun
    deepWaterOffsetC: -2.8, // Deep water stays cooler
    flowingRiverOffsetC: -1.6, // Flowing river water is cooler than still pond/lake
    stillPondBonusC: 1.2, // Still lake/pond retains warmth
  },
  metabolism: {
    endothermThermoregulationEnergyPerDegSec: 0.032, // Linear extra energy burn outside TNZ
    endothermPantingHydratePerDegSec: 0.085, // Panting/sweating water loss when bodyTemp > tOptHigh
    endothermPantingStaminaCapPenaltyMax: 0.35, // Panting reduces available stamina cap/regen
    crouchingBmrMultiplier: 0.72, // Crouching/curling up saves metabolic energy when cold
    heatstrokeHpDrainPerDegSec: 1.85, // HP loss per second when bodyTemp > tMax
    torporSpeedFloor: 0.05, // Near-immobilized when bodyTemp <= tMin
  },
  diurnalWater: {
    waterThermalLagRad: 0.85, // ~3.2 hours phase lag behind air temperature
    waterAmplitudeRatio: 0.38, // Water fluctuates much less than air
  },
  speciesProfiles: {
    deer: {
      thermalType: 'endotherm',
      bodyTempTarget: 37.5,
      tMin: 31.0,
      tOptLow: 36.0,
      tOptHigh: 39.1,
      tMax: 42.2,
      tnzLow: 10.0,
      tnzHigh: 29.0,
      baseBmrPerSec: 0.11,
      q10: 2.0,
      refTemp: 37.5,
      insulationFactor: 0.65,
    },
    wolf: {
      thermalType: 'endotherm',
      bodyTempTarget: 37.8,
      tMin: 30.0,
      tOptLow: 36.2,
      tOptHigh: 39.3,
      tMax: 42.3,
      tnzLow: 4.0,
      tnzHigh: 27.0,
      baseBmrPerSec: 0.13,
      q10: 2.0,
      refTemp: 37.8,
      insulationFactor: 0.55,
    },
    tiger: {
      thermalType: 'endotherm',
      bodyTempTarget: 37.5,
      tMin: 30.5,
      tOptLow: 36.0,
      tOptHigh: 39.2,
      tMax: 42.4,
      tnzLow: 8.0,
      tnzHigh: 31.0,
      baseBmrPerSec: 0.14,
      q10: 2.0,
      refTemp: 37.5,
      insulationFactor: 0.6,
    },
    jaguar: {
      thermalType: 'endotherm',
      bodyTempTarget: 37.5,
      tMin: 31.0,
      tOptLow: 36.0,
      tOptHigh: 39.3,
      tMax: 42.5,
      tnzLow: 12.0,
      tnzHigh: 33.0,
      baseBmrPerSec: 0.13,
      q10: 2.0,
      refTemp: 37.5,
      insulationFactor: 0.68,
    },
    eagle: {
      thermalType: 'endotherm',
      bodyTempTarget: 38.2,
      tMin: 32.0,
      tOptLow: 36.5,
      tOptHigh: 39.6,
      tMax: 43.0,
      tnzLow: 8.0,
      tnzHigh: 31.0,
      baseBmrPerSec: 0.12,
      q10: 2.0,
      refTemp: 38.2,
      insulationFactor: 0.62,
    },
    owl: {
      thermalType: 'endotherm',
      bodyTempTarget: 38.0,
      tMin: 31.5,
      tOptLow: 36.4,
      tOptHigh: 39.5,
      tMax: 42.8,
      tnzLow: 6.0,
      tnzHigh: 29.0,
      baseBmrPerSec: 0.1,
      q10: 2.0,
      refTemp: 38.0,
      insulationFactor: 0.58,
    },
    capybara: {
      thermalType: 'endotherm',
      bodyTempTarget: 37.0,
      tMin: 30.5,
      tOptLow: 35.6,
      tOptHigh: 38.8,
      tMax: 41.8,
      tnzLow: 14.0,
      tnzHigh: 32.0,
      baseBmrPerSec: 0.1,
      q10: 2.0,
      refTemp: 37.0,
      insulationFactor: 0.72,
    },
    rabbit: {
      thermalType: 'endotherm',
      bodyTempTarget: 37.8,
      tMin: 31.0,
      tOptLow: 36.2,
      tOptHigh: 39.4,
      tMax: 42.4,
      tnzLow: 10.0,
      tnzHigh: 28.5,
      baseBmrPerSec: 0.12,
      q10: 2.0,
      refTemp: 37.8,
      insulationFactor: 0.64,
    },
    crocodile: {
      thermalType: 'ectotherm',
      bodyTempTarget: 30.5,
      tMin: 11.0,
      tOptLow: 25.5,
      tOptHigh: 33.8,
      tMax: 39.2,
      tnzLow: 25.5,
      tnzHigh: 33.8,
      baseBmrPerSec: 0.045,
      q10: 2.25,
      refTemp: 28.0,
      insulationFactor: 1.0,
    },
    anaconda: {
      thermalType: 'ectotherm',
      bodyTempTarget: 29.8,
      tMin: 11.5,
      tOptLow: 25.0,
      tOptHigh: 33.2,
      tMax: 38.8,
      tnzLow: 25.0,
      tnzHigh: 33.2,
      baseBmrPerSec: 0.04,
      q10: 2.3,
      refTemp: 28.0,
      insulationFactor: 1.0,
    },
    snake: {
      thermalType: 'ectotherm',
      bodyTempTarget: 30.0,
      tMin: 10.5,
      tOptLow: 24.5,
      tOptHigh: 33.5,
      tMax: 39.0,
      tnzLow: 24.5,
      tnzHigh: 33.5,
      baseBmrPerSec: 0.048,
      q10: 2.25,
      refTemp: 28.0,
      insulationFactor: 1.0,
    },
  } as Record<string, SpeciesThermalProfile>,
} as const;

export function getSpeciesThermalProfile(species?: string): SpeciesThermalProfile {
  if (species && PHYSIOLOGY_CONFIG.speciesProfiles[species]) {
    return PHYSIOLOGY_CONFIG.speciesProfiles[species];
  }
  return PHYSIOLOGY_CONFIG.speciesProfiles.deer;
}

export function thermalPerformance(bodyTemp: number, species: string = 'deer'): number {
  const p = getSpeciesThermalProfile(species);
  if (bodyTemp <= p.tMin || bodyTemp >= p.tMax) {
    return 0;
  }
  if (bodyTemp >= p.tOptLow && bodyTemp <= p.tOptHigh) {
    return 1.0;
  }
  if (bodyTemp < p.tOptLow) {
    const ratio = Math.max(0, Math.min(1, (bodyTemp - p.tMin) / Math.max(0.1, p.tOptLow - p.tMin)));
    return Number((ratio * ratio * (3 - 2 * ratio)).toFixed(4));
  }
  const hotRatio = Math.max(0, Math.min(1, (bodyTemp - p.tOptHigh) / Math.max(0.1, p.tMax - p.tOptHigh)));
  return Number(Math.pow(1 - hotRatio, 1.65).toFixed(4));
}

export function computeLocalWaterTemperature(params: {
  baseWaterTemp: number;
  waterDepth?: number;
  isFlowingRiver?: boolean;
  isDaytime?: boolean;
}): number {
  const depth = Math.max(0, params.waterDepth ?? 0.6);
  const isFlowing = params.isFlowingRiver ?? true;
  const isDay = params.isDaytime ?? true;
  let localTemp = params.baseWaterTemp;

  if (depth < 0.75) {
    localTemp += isDay ? PHYSIOLOGY_CONFIG.microclimate.shallowWaterDayBonusC * (1 - depth / 0.75) : -0.5;
  } else if (depth > 1.6) {
    const deepFactor = Math.min(1, (depth - 1.6) / 2.5);
    localTemp += PHYSIOLOGY_CONFIG.microclimate.deepWaterOffsetC * deepFactor;
  }

  if (isFlowing) {
    localTemp += PHYSIOLOGY_CONFIG.microclimate.flowingRiverOffsetC * 0.5;
  } else {
    localTemp += PHYSIOLOGY_CONFIG.microclimate.stillPondBonusC;
  }

  return Number(localTemp.toFixed(2));
}

export function computeMassAndMetabolismState(params: {
  species: string;
  age: number;
  energy: number;
  currentWeight: number;
  stomachLoad: number;
  bodyTemp: number;
  dt: number;
}): {
  nextWeight: number;
  nextStomachLoad: number;
  nextEnergy: number;
  totalMass: number;
  isStarving: boolean;
  isOverstuffed: boolean;
  agileAnimationsLocked: boolean;
  digestionRate: number;
  speedMultiplier: number;
  effectiveGravity: number;
  combatBonusMultiplier: number;
  constrictionDrainMultiplier: number;
  bellyBulgeScale: number;
  modelScale: number;
  thermalPerf: number;
  bmrMultiplier: number;
} {
  const profile = getSpeciesWeightProfile(params.species);
  const thermalProfile = getSpeciesThermalProfile(params.species);
  const { dt } = params;
  let { energy, currentWeight, stomachLoad, bodyTemp } = params;

  const isStarving = energy < 25;
  const isOverstuffed = energy > 100 || stomachLoad > currentWeight * 0.28;

  const thermalPerf = thermalPerformance(bodyTemp, params.species);
  const tempFactor = Math.max(0.18, 0.2 + 0.8 * thermalPerf);

  const bmrMultiplier =
    thermalProfile.thermalType === 'ectotherm'
      ? Number(Math.pow(thermalProfile.q10, (bodyTemp - thermalProfile.refTemp) / 10.0).toFixed(3))
      : Number((1.0 + Math.max(0, Math.abs(bodyTemp - thermalProfile.bodyTempTarget) * 0.12)).toFixed(3));

  // Energy factor: proportional to energy, but OVERSTUFFED (energy > 100 or heavy stomachLoad) slows digestion down!
  const energyFactor = isOverstuffed
    ? Math.max(0.28, 0.52 - Math.min(0.24, Math.max(0, energy - 100) * 0.004 + (stomachLoad / Math.max(1, currentWeight)) * 0.25))
    : Math.max(0.25, Math.min(1.25, energy / 75.0));

  const digestionRate = Number((tempFactor * energyFactor).toFixed(4));

  // ONLY eating food (stomachLoad > 0) increases currentWeight — time/age NEVER passively increases weight!
  if (stomachLoad > 0 && dt > 0) {
    const maxDigestPerSec = profile.idealMaxWeight * 0.018 * digestionRate;
    const digested = Math.min(stomachLoad, maxDigestPerSec * dt);
    stomachLoad = Math.max(0, stomachLoad - digested);
    const growthEfficiency = 0.85 * Math.max(0.25, thermalPerf);
    currentWeight = Math.min(profile.idealMaxWeight * 1.28, currentWeight + digested * growthEfficiency);
  }

  if (dt > 0) {
    if (isStarving && stomachLoad <= 0) {
      // Starving burns body weight
      const weightLoss = profile.idealMaxWeight * 0.0022 * (1.0 - energy / 25.0);
      currentWeight = Math.max(profile.baseYoungWeight * 0.65, currentWeight - weightLoss * dt);
    }
    // Overstuffed energy above 100 slowly settles as digestion proceeds
    if (energy > 100) {
      energy = Math.max(100, energy - 1.15 * digestionRate * dt);
    }
  }

  const totalMass = currentWeight + stomachLoad;
  const massRatio = totalMass / Math.max(0.1, profile.idealMaxWeight);
  const stomachRatio = stomachLoad / Math.max(0.1, currentWeight);

  // Gravity acts directly on TotalMass (CurrentWeight + StomachLoad)
  const effectiveGravity = Number(
    (GRAVITY * (1.0 + Math.max(0, massRatio - 0.55) * 0.42 + stomachRatio * 0.85)).toFixed(3)
  );

  // Speed multiplier: heavier mass + gravity slows movement; Starving slows movement; Overstuffed heavily slows movement; thermalPerf scales activity
  const thermalSpeedFactor = Math.max(PHYSIOLOGY_CONFIG.metabolism.torporSpeedFloor, 0.25 + 0.75 * thermalPerf);
  let speedMultiplier = (1.0 / (1.0 + Math.max(0, massRatio - 0.65) * 0.32 + stomachRatio * 0.78)) * thermalSpeedFactor;
  if (isStarving) {
    speedMultiplier *= 0.62;
  }
  if (isOverstuffed) {
    speedMultiplier *= 0.48;
  }
  speedMultiplier = Number(Math.max(0.12, Math.min(1.15, speedMultiplier)).toFixed(3));

  const agileAnimationsLocked = Boolean(isOverstuffed || stomachRatio > 0.24 || thermalPerf < 0.35);

  // Heavy weight compensates with stronger attack damage (Tiger, Jaguar, Wolf, Crocodile) & faster breath drain (Anaconda, Crocodile)
  const weightPowerRatio = currentWeight / Math.max(0.1, profile.idealMaxWeight);
  const combatBonusMultiplier = Number(((0.72 + weightPowerRatio * 0.68) * Math.max(0.35, thermalPerf)).toFixed(3));
  const constrictionDrainMultiplier = Number(((0.75 + weightPowerRatio * 0.85) * Math.max(0.35, thermalPerf)).toFixed(3));

  // Visual belly bulge scale ONLY when StomachLoad > 0 or Overstuffed (Energy > 100), never at normal spawn!
  const overEnergyRatio = Math.max(0, (energy - 100) / 55);
  const bellyBulgeScale = (stomachLoad > 0.01 || energy > 100)
    ? Number(Math.min(1.55, 1.0 + stomachRatio * 1.15 + overEnergyRatio * 0.32).toFixed(3))
    : 1.0;

  // Size (modelScale) scales strictly with CurrentWeight (food eaten), NEVER with time/age, and stays within realistic non-giant proportions!
  const weightGrowthProgress = Math.max(
    0,
    (currentWeight - profile.baseYoungWeight) / Math.max(0.1, profile.idealMaxWeight - profile.baseYoungWeight)
  );
  const modelScale = Number(
    Math.max(0.48, Math.min(0.96, 0.52 + weightGrowthProgress * 0.36)).toFixed(3)
  );

  return {
    nextWeight: Number(currentWeight.toFixed(2)),
    nextStomachLoad: Number(stomachLoad.toFixed(2)),
    nextEnergy: Number(energy.toFixed(2)),
    totalMass: Number(totalMass.toFixed(2)),
    isStarving,
    isOverstuffed,
    agileAnimationsLocked,
    digestionRate,
    speedMultiplier,
    effectiveGravity,
    combatBonusMultiplier,
    constrictionDrainMultiplier,
    bellyBulgeScale,
    modelScale,
    thermalPerf,
    bmrMultiplier,
  };
}

export function evaluatePredatorPreyWeightContest(
  predatorWeight: number,
  preyWeight: number
): {
  canSubdue: boolean;
  preyBreaksFree: boolean;
  counterAttackProbability: number;
  counterDamageRatio: number;
} {
  // "Cá Lớn Nuốt Cá Bé": If predator is lighter than 88% of prey's weight, prey has high probability to break free & counter-attack!
  const ratio = predatorWeight / Math.max(0.1, preyWeight);
  if (ratio >= 0.88) {
    return {
      canSubdue: true,
      preyBreaksFree: false,
      counterAttackProbability: 0,
      counterDamageRatio: 0,
    };
  }
  const deficit = (0.88 - ratio) / 0.88;
  const counterAttackProbability = Number(Math.min(0.95, 0.52 + deficit * 0.45).toFixed(3));
  return {
    canSubdue: false,
    preyBreaksFree: true,
    counterAttackProbability,
    counterDamageRatio: Number(Math.min(1.6, 0.55 + (preyWeight / Math.max(0.1, predatorWeight)) * 0.35).toFixed(3)),
  };
}

export function calculateBiomassFromWeight(currentWeight: number): number {
  return Math.max(1, Math.round(currentWeight * 10) / 10);
}

export function evaluateEndgameReproductionEligibility(
  species: string,
  age: number,
  currentWeight: number
): {
  biomass: number;
  minRequiredWeight: number;
  idealMaxWeight: number;
  weightPercentOfIdeal: number;
  canReproduce: boolean;
  malnourishedEndgame: boolean;
  reproductionType: 'egg' | 'baby';
  nestBiomassCost: number;
} {
  const profile = getSpeciesWeightProfile(species);
  const biomass = calculateBiomassFromWeight(currentWeight);
  const weightPercentOfIdeal = Number(((currentWeight / profile.idealMaxWeight) * 100).toFixed(1));
  const meetsWeightThreshold = currentWeight >= profile.minReproductionWeight;
  const isMatureEnough = age >= 120; // Can reproduce once mature & >=70% ideal max weight, or at 15-min mark
  const malnourishedEndgame = age >= LIFESPAN_SECONDS && !meetsWeightThreshold;

  return {
    biomass,
    minRequiredWeight: profile.minReproductionWeight,
    idealMaxWeight: profile.idealMaxWeight,
    weightPercentOfIdeal,
    canReproduce: meetsWeightThreshold && isMatureEnough,
    malnourishedEndgame,
    reproductionType: profile.reproductionType,
    nestBiomassCost: profile.nestBiomassCost,
  };
}

export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherEventKey = 'clear' | 'rain' | 'drought' | 'first_summer_rain' | 'autumn_wind' | 'snow' | 'snowstorm';

export interface SeasonWeatherState {
  season: SeasonKey;
  seasonNameVi: string;
  seasonDayIndex: number; // 1..7 within the 7-day season
  weather: WeatherEventKey;
  weatherLabelVi: string;
  envTemp: number; // °C
  waterTemp: number; // °C
  waterLevel: number; // World Y of water surface
  iceCoverage: number; // 0 = no ice, 0.45 = partial winter river ice, 1.0 = full snowstorm freeze
  droughtFactor: number; // 0..1 parched earth & withered plants
  lushFactor: number; // 0..1 vibrant green restoration from First Summer Rain
}

export function computeSeasonWeatherAndWaterState(params: {
  gameTime: number;
  dayDuration?: number;
  lunarIllumination?: number;
  overrideSeason?: SeasonKey | null;
  overrideWeather?: WeatherEventKey | null;
  overrideEnvTemp?: number | null;
}): SeasonWeatherState {
  const dayDuration = params.dayDuration || 180;
  const lunarIllumination = params.lunarIllumination ?? 0.5;
  const totalDays = Math.floor(Math.max(0, params.gameTime) / dayDuration);
  const seasonLengthDays = 7; // Each season lasts 7 days and 7 nights
  const seasonOrder: SeasonKey[] = ['spring', 'summer', 'autumn', 'winter'];
  const computedSeasonIdx = Math.floor(totalDays / seasonLengthDays) % 4;
  const season: SeasonKey = params.overrideSeason || seasonOrder[computedSeasonIdx];
  const seasonDayIndex = (totalDays % seasonLengthDays) + 1;

  const dayProgress = (params.gameTime % dayDuration) / dayDuration;
  const diurnalWave = Math.sin(dayProgress * Math.PI * 2); // +1 at noon, -1 at midnight

  let envTemp = 23.0;
  let waterTemp = 20.0;
  let weather: WeatherEventKey = 'clear';
  let weatherLabelVi = 'Quang đãng';
  let iceCoverage = 0.0;
  let droughtFactor = 0.0;
  let lushFactor = 0.0;

  const seasonNames: Record<SeasonKey, string> = {
    spring: '🌸 Mùa Xuân',
    summer: '☀️ Mùa Hạ',
    autumn: '🍂 Mùa Thu',
    winter: '❄️ Mùa Đông',
  };

  if (season === 'spring') {
    envTemp = 22.5 + diurnalWave * 3.8 + Math.sin(params.gameTime * 0.02) * 1.2;
    waterTemp = 20.5 + diurnalWave * 1.5;
    weather = 'clear';
    weatherLabelVi = 'Tiết xuân ấm áp';
  } else if (season === 'summer') {
    // Summer fluctuates between 28°C and 42°C
    const heatCycle = 0.5 + 0.5 * Math.sin(params.gameTime * 0.025 + seasonDayIndex * 0.9);
    envTemp = 28.0 + heatCycle * 11.0 + Math.max(0, diurnalWave) * 3.0;
    if (params.overrideEnvTemp !== null && params.overrideEnvTemp !== undefined) {
      envTemp = params.overrideEnvTemp;
    }

    if (params.overrideWeather === 'first_summer_rain' || (seasonDayIndex === 5 && dayProgress > 0.35 && dayProgress < 0.75)) {
      weather = 'first_summer_rain';
      weatherLabelVi = '🌧️ Cơn Mưa Đầu Mùa Hạ (The First Summer Rain)';
      envTemp = Math.min(envTemp, 31.5);
      lushFactor = 1.0;
      droughtFactor = 0.0;
    } else if (envTemp >= 34.0 && envTemp <= 37.0) {
      weather = 'rain';
      weatherLabelVi = '🌦️ Mưa Rào Mùa Hạ';
      droughtFactor = 0.15;
    } else if (envTemp > 37.0) {
      weather = 'drought';
      weatherLabelVi = '🔥 Nắng Nóng Khô Hạn (>37°C)';
      droughtFactor = Math.min(1.0, (envTemp - 37.0) / 4.0 + 0.35);
    } else {
      weather = 'clear';
      weatherLabelVi = '☀️ Nắng Gắt Mùa Hạ';
    }
    waterTemp = Math.max(24.0, envTemp - 3.5);
  } else if (season === 'autumn') {
    envTemp = 17.5 + diurnalWave * 4.2 + Math.cos(params.gameTime * 0.02) * 1.5;
    waterTemp = 15.5 + diurnalWave * 1.6;
    weather = 'autumn_wind';
    weatherLabelVi = '🍂 Gió Thu Lá Vàng Rơi';
  } else if (season === 'winter') {
    // Winter: -8°C to 17°C, or Snowstorm below -8°C
    const coldWave = 0.5 + 0.5 * Math.cos(params.gameTime * 0.03 + seasonDayIndex * 1.1);
    envTemp = -6.5 + coldWave * 21.0 + diurnalWave * 2.5;
    if (params.overrideWeather === 'snowstorm' || (seasonDayIndex === 4 && dayProgress > 0.4 && dayProgress < 0.85)) {
      weather = 'snowstorm';
      weatherLabelVi = '🌨️ BÃO TUYẾT CỰC HÀN (Snowstorm)';
      envTemp = Math.min(-12.5, envTemp - 14.0);
      waterTemp = -1.5;
      iceCoverage = 1.0; // Freezes river & ponds completely
    } else {
      weather = 'snow';
      weatherLabelVi = '❄️ Tuyết Rơi Mùa Đông';
      waterTemp = Math.max(1.2, Math.min(8.5, envTemp * 0.4 + 3.5));
      iceCoverage = envTemp < 4.0 ? 0.48 : 0.25; // Partial river ice
    }
  }

  if (params.overrideEnvTemp !== null && params.overrideEnvTemp !== undefined) {
    envTemp = params.overrideEnvTemp;
    if (season === 'summer' && params.overrideWeather === undefined) {
      if (envTemp >= 34.0 && envTemp <= 37.0) {
        weather = 'rain';
        weatherLabelVi = '🌦️ Mưa Rào Mùa Hạ';
      } else if (envTemp > 37.0) {
        weather = 'drought';
        weatherLabelVi = '🔥 Nắng Nóng Khô Hạn (>37°C)';
        droughtFactor = Math.min(1.0, (envTemp - 37.0) / 4.0 + 0.4);
      }
    }
  }
  if (params.overrideWeather) {
    weather = params.overrideWeather;
    if (weather === 'first_summer_rain') {
      weatherLabelVi = '🌧️ Cơn Mưa Đầu Mùa Hạ (The First Summer Rain)';
      lushFactor = 1.0;
      droughtFactor = 0.0;
    } else if (weather === 'snowstorm') {
      weatherLabelVi = '🌨️ BÃO TUYẾT CỰC HÀN (Snowstorm)';
      envTemp = Math.min(-12.0, envTemp);
      waterTemp = -1.5;
      iceCoverage = 1.0;
    }
  }

  let waterLevel = WATER;
  if (lunarIllumination > 0.72) {
    waterLevel += (lunarIllumination - 0.72) / 0.28 * 0.85;
  }
  if (weather === 'first_summer_rain') {
    waterLevel += 0.58;
  } else if (season === 'summer') {
    if (weather === 'rain') {
      waterLevel -= 0.22;
    } else if (weather === 'drought' || envTemp > 37.0) {
      waterLevel -= 0.82;
    } else if (envTemp > 33.0) {
      waterLevel -= 0.15;
    }
  }

  return {
    season,
    seasonNameVi: seasonNames[season],
    seasonDayIndex,
    weather,
    weatherLabelVi,
    envTemp: Number(envTemp.toFixed(1)),
    waterTemp: Number(waterTemp.toFixed(1)),
    waterLevel: Number(waterLevel.toFixed(3)),
    iceCoverage: Number(iceCoverage.toFixed(2)),
    droughtFactor: Number(droughtFactor.toFixed(2)),
    lushFactor: Number(lushFactor.toFixed(2)),
  };
}

export interface InertialThermalStepResult {
  nextBodyTemp: number;
  effectiveEnvTemp: number;
  exchangeRate: number;
  tempDeltaPerMin: number;
  trendArrow: '↑' | '↓' | '→';
  thermalPerf: number;
  bmrEnergyDrainPerSec: number;
  thermoregulationEnergyDrainPerSec: number;
  pantingHydrateDrainPerSec: number;
  staminaCapMultiplier: number;
  hpHeatstrokeDrainPerSec: number;
  isHyperthermic: boolean;
  isHypothermic: boolean;
  isTorpor: boolean;
  isHeatstroke: boolean;
  isPanting: boolean;
  isShivering: boolean;
  thermalStatusVi: string;
  diagnosticMessageVi: string;
}

export function computeBodyTemperatureStep(params: {
  currentBodyTemp: number;
  envTemp: number;
  waterTemp: number;
  inWater: boolean;
  isExposedToSun: boolean;
  inCaveOrShade: boolean;
  isSprinting: boolean;
  dt: number;
  species?: string;
  totalMassKg?: number;
  energy?: number;
  windSpeed?: number;
  isRaining?: boolean;
  isBasking?: boolean;
  isCrouching?: boolean;
  waterDepth?: number;
  isFlowingRiver?: boolean;
  isAfternoon?: boolean;
}): InertialThermalStepResult {
  const species = params.species || 'deer';
  const profile = getSpeciesThermalProfile(species);
  const weightProfile = getSpeciesWeightProfile(species);
  const {
    envTemp,
    waterTemp,
    inWater,
    isExposedToSun,
    inCaveOrShade,
    isSprinting,
    dt,
  } = params;
  let { currentBodyTemp } = params;

  const totalMass = Math.max(0.8, params.totalMassKg ?? weightProfile.idealMaxWeight * 0.55);
  const energy = params.energy ?? 80;
  const windSpeed = Math.max(0, params.windSpeed ?? 3.5);
  const isRaining = Boolean(params.isRaining);
  const isBasking = Boolean(params.isBasking);
  const isCrouching = Boolean(params.isCrouching);
  const isAfternoon = Boolean(params.isAfternoon);

  // 1. Compute effective environmental temperature at the animal's exact microclimate
  let effectiveEnvTemp = envTemp;
  if (inWater) {
    effectiveEnvTemp = computeLocalWaterTemperature({
      baseWaterTemp: waterTemp,
      waterDepth: params.waterDepth ?? 0.8,
      isFlowingRiver: params.isFlowingRiver ?? true,
      isDaytime: isExposedToSun,
    });
  } else {
    if (isExposedToSun && !inCaveOrShade) {
      effectiveEnvTemp += PHYSIOLOGY_CONFIG.microclimate.directSunBonusC;
      if (isBasking) {
        effectiveEnvTemp += PHYSIOLOGY_CONFIG.microclimate.baskingPostureBonusC;
      }
    }
    if (inCaveOrShade) {
      effectiveEnvTemp += PHYSIOLOGY_CONFIG.microclimate.shadeOrCanopyOffsetC;
    }
    if (isRaining && !inCaveOrShade) {
      effectiveEnvTemp += PHYSIOLOGY_CONFIG.microclimate.rainOffsetC;
    }
    if (isAfternoon && !inWater && !inCaveOrShade) {
      effectiveEnvTemp += PHYSIOLOGY_CONFIG.microclimate.afternoonGroundWarmthC;
    }
    if (windSpeed > 1.5 && !inCaveOrShade && effectiveEnvTemp < currentBodyTemp) {
      effectiveEnvTemp -= (windSpeed - 1.5) * PHYSIOLOGY_CONFIG.microclimate.windChillFactorC;
    }
    if (isSprinting) {
      effectiveEnvTemp += PHYSIOLOGY_CONFIG.microclimate.sprintingMetabolicHeatC;
    }
  }

  // 2. Compute heat exchange rate: depends on (a) medium (water 18x air), (b) mass^-0.33 & maturity, (c) thermal type / posture
  const massFactor = Math.pow(totalMass / 25.0, -PHYSIOLOGY_CONFIG.heatExchange.massExponent);
  const maturityRatio = Math.min(1, totalMass / Math.max(1, weightProfile.idealMaxWeight));
  const juvenileMultiplier = 1.0 + (1.0 - maturityRatio) * (PHYSIOLOGY_CONFIG.heatExchange.juvenileExchangeMultiplier - 1.0);

  let exchangeRate = PHYSIOLOGY_CONFIG.heatExchange.airBaseExchangeRate * massFactor * juvenileMultiplier * profile.insulationFactor;
  if (inWater) {
    exchangeRate *= PHYSIOLOGY_CONFIG.heatExchange.waterExchangeMultiplier;
  } else {
    if (isBasking && isExposedToSun && !inCaveOrShade) {
      exchangeRate *= PHYSIOLOGY_CONFIG.heatExchange.baskingExchangeMultiplier;
    }
    if (isCrouching && effectiveEnvTemp < currentBodyTemp) {
      exchangeRate *= PHYSIOLOGY_CONFIG.heatExchange.crouchingExchangeMultiplier;
    }
    if (isRaining && !inCaveOrShade) {
      exchangeRate *= PHYSIOLOGY_CONFIG.heatExchange.rainWetExchangeMultiplier;
    }
    if (windSpeed > 1.0 && !inCaveOrShade) {
      exchangeRate *= 1.0 + windSpeed * PHYSIOLOGY_CONFIG.heatExchange.windExchangeFactorPerMs;
    }
  }

  // 3. Endotherm vs Ectotherm thermal dynamics:
  // Every tick: bodyTemp += (equilibriumTemp - bodyTemp) * exchangeRate * dt
  let thermoregulationEnergyDrainPerSec = 0;
  let equilibriumTemp = effectiveEnvTemp;

  if (profile.thermalType === 'endotherm') {
    const canThermoregulate = energy > 5.0;
    if (canThermoregulate) {
      let envPull = 0;
      if (effectiveEnvTemp < profile.tnzLow) {
        const coldOutside = profile.tnzLow - effectiveEnvTemp;
        thermoregulationEnergyDrainPerSec = coldOutside * PHYSIOLOGY_CONFIG.metabolism.endothermThermoregulationEnergyPerDegSec;
        if (isCrouching) {
          thermoregulationEnergyDrainPerSec *= PHYSIOLOGY_CONFIG.metabolism.crouchingBmrMultiplier;
        }
        envPull = -coldOutside * (inWater ? 0.24 : 0.16);
      } else if (effectiveEnvTemp > profile.tnzHigh) {
        const hotOutside = effectiveEnvTemp - profile.tnzHigh;
        thermoregulationEnergyDrainPerSec = hotOutside * PHYSIOLOGY_CONFIG.metabolism.endothermThermoregulationEnergyPerDegSec * 0.85;
        envPull = hotOutside * (inWater ? 0.14 : 0.22);
      } else {
        envPull = (effectiveEnvTemp - (profile.tnzLow + profile.tnzHigh) * 0.5) * 0.04;
      }
      equilibriumTemp = profile.bodyTempTarget + envPull + (isSprinting ? 0.55 : 0);
    } else {
      equilibriumTemp = effectiveEnvTemp + (isSprinting ? 0.35 : 0);
    }
  } else {
    // Ectotherm: bodyTemp follows effectiveEnvTemp via inertial heat exchange without burning energy for internal heating
    equilibriumTemp = effectiveEnvTemp + (isSprinting ? 0.3 : 0);
  }

  const prevBodyTemp = currentBodyTemp;
  const stepFraction = Math.min(1.0, exchangeRate * dt);
  currentBodyTemp += (equilibriumTemp - currentBodyTemp) * stepFraction;
  currentBodyTemp = Math.max(4.0, Math.min(44.5, currentBodyTemp));

  const tempDeltaPerSec = dt > 0.0001 ? (currentBodyTemp - prevBodyTemp) / dt : 0;
  const tempDeltaPerMin = Number((tempDeltaPerSec * 60.0).toFixed(1));
  const trendArrow: '↑' | '↓' | '→' =
    tempDeltaPerMin >= 0.3 ? '↑' : tempDeltaPerMin <= -0.3 ? '↓' : '→';

  // 4. Compute performance curve & downstream metabolic/physiological effects
  const thermalPerf = thermalPerformance(currentBodyTemp, species);

  const bmrEnergyDrainPerSec =
    profile.thermalType === 'ectotherm'
      ? Number(
          (
            profile.baseBmrPerSec *
            Math.pow(profile.q10, (currentBodyTemp - profile.refTemp) / 10.0) *
            (isCrouching ? PHYSIOLOGY_CONFIG.metabolism.crouchingBmrMultiplier : 1.0)
          ).toFixed(4)
        )
      : Number(
          (
            profile.baseBmrPerSec *
              (isCrouching ? PHYSIOLOGY_CONFIG.metabolism.crouchingBmrMultiplier : 1.0) +
            thermoregulationEnergyDrainPerSec
          ).toFixed(4)
        );

  const isPanting = profile.thermalType === 'endotherm' && currentBodyTemp > profile.tOptHigh;
  const pantingExcess = isPanting ? Math.max(0, currentBodyTemp - profile.tOptHigh) : 0;
  const pantingHydrateDrainPerSec = Number(
    (pantingExcess * PHYSIOLOGY_CONFIG.metabolism.endothermPantingHydratePerDegSec).toFixed(4)
  );
  const staminaCapMultiplier = Number(
    Math.max(
      0.25,
      thermalPerf *
        (1.0 - Math.min(PHYSIOLOGY_CONFIG.metabolism.endothermPantingStaminaCapPenaltyMax, pantingExcess * 0.12))
    ).toFixed(3)
  );

  const isTorpor = currentBodyTemp <= profile.tMin + 0.5;
  const isHeatstroke = currentBodyTemp >= profile.tMax - 0.3;
  const isHyperthermic = currentBodyTemp >= profile.tOptHigh + 0.4;
  const isHypothermic = currentBodyTemp <= profile.tOptLow - 1.8;
  const isShivering = isHypothermic && !isTorpor;

  const hpHeatstrokeDrainPerSec =
    currentBodyTemp > profile.tMax
      ? Number(((currentBodyTemp - profile.tMax) * PHYSIOLOGY_CONFIG.metabolism.heatstrokeHpDrainPerDegSec).toFixed(3))
      : isTorpor
        ? Number(((profile.tMin + 0.5 - currentBodyTemp) * 0.65).toFixed(3))
        : 0;

  const speedPenaltyPct = Math.round((1.0 - (0.25 + 0.75 * thermalPerf)) * 100);
  let thermalStatusVi = 'Ổn định';
  let diagnosticMessageVi = `Hiệu suất nhiệt ${Math.round(thermalPerf * 100)}% (Tối ưu ${profile.tOptLow}–${profile.tOptHigh}°C)`;

  if (isHeatstroke) {
    thermalStatusVi = '🔥 Sốc nhiệt nguy kịch';
    diagnosticMessageVi = `Sốc nhiệt (> ${profile.tMax}°C): mất máu & choáng, tốc độ -${speedPenaltyPct}%`;
  } else if (isHyperthermic) {
    thermalStatusVi = '🔥 Quá nóng (Thở dốc)';
    diagnosticMessageVi = `Tốc độ -${speedPenaltyPct}% & tốn nước do thân nhiệt cao (${currentBodyTemp.toFixed(1)}°C)`;
  } else if (isTorpor) {
    thermalStatusVi = '🥶 Tê cứng (Torpor)';
    diagnosticMessageVi = `Tê cứng (< ${profile.tMin}°C): hầu như bất động, tốc độ -${speedPenaltyPct}%`;
  } else if (isHypothermic) {
    thermalStatusVi = '🥶 Hạ thân nhiệt (Lạnh)';
    diagnosticMessageVi = `Tốc độ -${speedPenaltyPct}% & tiêu hóa chậm do thân nhiệt thấp (${currentBodyTemp.toFixed(1)}°C)`;
  } else if (isBasking) {
    thermalStatusVi = '☀️ Đang phơi nắng';
    diagnosticMessageVi = `Phơi nắng hấp thụ nhiệt (+${tempDeltaPerMin}°C/phút) • Hiệu suất ${Math.round(thermalPerf * 100)}%`;
  }

  return {
    nextBodyTemp: Number(currentBodyTemp.toFixed(1)),
    effectiveEnvTemp: Number(effectiveEnvTemp.toFixed(1)),
    exchangeRate: Number(exchangeRate.toFixed(4)),
    tempDeltaPerMin,
    trendArrow,
    thermalPerf,
    bmrEnergyDrainPerSec,
    thermoregulationEnergyDrainPerSec: Number(thermoregulationEnergyDrainPerSec.toFixed(4)),
    pantingHydrateDrainPerSec,
    staminaCapMultiplier,
    hpHeatstrokeDrainPerSec,
    isHyperthermic,
    isHypothermic,
    isTorpor,
    isHeatstroke,
    isPanting,
    isShivering,
    thermalStatusVi,
    diagnosticMessageVi,
  };
}

export const ECOSYSTEM_SPAWN_PLAN: ReadonlyArray<{ species: string; count: number }> = [
  { species: 'deer', count: 36 },
  { species: 'capybara', count: 26 },
  { species: 'rabbit', count: 30 },
  { species: 'snake', count: 38 },
  { species: 'wolf', count: 20 },
  { species: 'tiger', count: 12 },
  { species: 'jaguar', count: 12 },
  { species: 'crocodile', count: 10 },
  { species: 'anaconda', count: 9 },
  { species: 'eagle', count: 14 },
  { species: 'owl', count: 14 },
];

export function isAquaticSpawnWellSpaced(
  candX: number,
  candZ: number,
  existingAquatics: ReadonlyArray<{ x: number; z: number }>,
  minSpacing = 45.0
): boolean {
  const minSq = minSpacing * minSpacing;
  for (let i = 0; i < existingAquatics.length; i++) {
    const dx = candX - existingAquatics[i].x;
    const dz = candZ - existingAquatics[i].z;
    if (dx * dx + dz * dz < minSq) {
      return false;
    }
  }
  return true;
}

export function canSpeciesClimbTree(species: string): boolean {
  return species === 'snake' || species === 'anaconda' || species === 'jaguar';
}

export function canSpeciesPerchOnTreeBranch(species: string): boolean {
  return species === 'eagle' || species === 'owl';
}

export interface TreeBranchPerch {
  id: string;
  treeX: number;
  treeZ: number;
  trunkRadius: number;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  y: number;
  dirX: number;
  dirZ: number;
  length: number;
  radius: number;
}

export function computeTreeClimbAndBranchState(params: {
  species: string;
  x: number;
  y: number;
  z: number;
  groundY: number;
  inputZ: number;
  spacePressed: boolean;
  cPressed: boolean;
  isClimbingTree: boolean;
  isOnBranch: boolean;
  activeBranch: TreeBranchPerch | null;
  branches: ReadonlyArray<TreeBranchPerch>;
  climbSpeed: number;
  dt: number;
}): {
  x: number;
  y: number;
  z: number;
  isClimbingTree: boolean;
  isOnBranch: boolean;
  isPerchedOnBranch: boolean;
  activeBranch: TreeBranchPerch | null;
} {
  const { species, groundY, inputZ, spacePressed, cPressed, branches, climbSpeed, dt } = params;
  let { x, y, z, isClimbingTree, isOnBranch, activeBranch } = params;

  // Aerial raptors (Eagle & Owl) can perch directly onto high tree branches when near a branch
  if (canSpeciesPerchOnTreeBranch(species)) {
    for (let i = 0; i < branches.length; i++) {
      const br = branches[i];
      const vx = br.endX - br.startX;
      const vz = br.endZ - br.startZ;
      const lenSq = Math.max(0.01, vx * vx + vz * vz);
      const t = Math.max(0.15, Math.min(0.95, ((x - br.startX) * vx + (z - br.startZ) * vz) / lenSq));
      const projX = br.startX + vx * t;
      const projZ = br.startZ + vz * t;
      const horizDist = Math.hypot(x - projX, z - projZ);
      const vertDist = Math.abs(y - br.y);
      if (horizDist <= br.radius + 1.8 && vertDist <= 2.2 && !spacePressed) {
        return {
          x: projX,
          y: br.y + 0.15,
          z: projZ,
          isClimbingTree: false,
          isOnBranch: true,
          isPerchedOnBranch: true,
          activeBranch: br,
        };
      }
    }
    return {
      x,
      y,
      z,
      isClimbingTree: false,
      isOnBranch: false,
      isPerchedOnBranch: false,
      activeBranch: null,
    };
  }

  if (!canSpeciesClimbTree(species)) {
    return {
      x,
      y,
      z,
      isClimbingTree: false,
      isOnBranch: false,
      isPerchedOnBranch: false,
      activeBranch: null,
    };
  }

  // If already on a branch, walk along the branch or climb down
  if (isOnBranch && activeBranch) {
    if (cPressed) {
      // Descend from branch
      return {
        x: activeBranch.startX + activeBranch.dirX * 1.4,
        y: Math.max(groundY, y - climbSpeed * dt),
        z: activeBranch.startZ + activeBranch.dirZ * 1.4,
        isClimbingTree: y - climbSpeed * dt > groundY + 0.35,
        isOnBranch: false,
        isPerchedOnBranch: false,
        activeBranch: y - climbSpeed * dt > groundY + 0.35 ? activeBranch : null,
      };
    }
    const vx = activeBranch.endX - activeBranch.startX;
    const vz = activeBranch.endZ - activeBranch.startZ;
    const len = Math.max(0.1, activeBranch.length);
    const curDist = Math.max(
      0,
      Math.min(len, ((x - activeBranch.startX) * vx + (z - activeBranch.startZ) * vz) / len)
    );
    const nextDist = Math.max(0.2, Math.min(len - 0.25, curDist + inputZ * climbSpeed * 0.85 * dt));
    x = activeBranch.startX + activeBranch.dirX * nextDist;
    z = activeBranch.startZ + activeBranch.dirZ * nextDist;
    y = activeBranch.y + 0.18;
    return {
      x,
      y,
      z,
      isClimbingTree: false,
      isOnBranch: true,
      isPerchedOnBranch: false,
      activeBranch,
    };
  }

  // Find nearest climbable tree trunk/branch
  let nearestBranch: TreeBranchPerch | null = activeBranch;
  if (!nearestBranch) {
    let bestD = 3.2;
    for (let i = 0; i < branches.length; i++) {
      const br = branches[i];
      const d = Math.hypot(x - br.treeX, z - br.treeZ);
      if (d <= br.trunkRadius + bestD) {
        bestD = d;
        nearestBranch = br;
      }
    }
  }

  if (nearestBranch) {
    const distToTrunk = Math.hypot(x - nearestBranch.treeX, z - nearestBranch.treeZ);
    const wantsClimbUp = (spacePressed || inputZ > 0) && distToTrunk <= nearestBranch.trunkRadius + 2.2;
    if (wantsClimbUp || isClimbingTree) {
      isClimbingTree = true;
      const climbDir = cPressed ? -1 : (spacePressed || inputZ > 0 ? 1 : (inputZ < 0 ? -1 : 0));
      y += climbDir * climbSpeed * dt;
      // Keep hugging the trunk perimeter while climbing vertically
      const pullX = nearestBranch.treeX + nearestBranch.dirX * (nearestBranch.trunkRadius + 0.35);
      const pullZ = nearestBranch.treeZ + nearestBranch.dirZ * (nearestBranch.trunkRadius + 0.35);
      x += (pullX - x) * Math.min(1, dt * 8.0);
      z += (pullZ - z) * Math.min(1, dt * 8.0);

      if (y >= nearestBranch.y) {
        // Reached branch height -> step out onto the protruding branch!
        y = nearestBranch.y + 0.18;
        x = nearestBranch.startX + nearestBranch.dirX * 1.2;
        z = nearestBranch.startZ + nearestBranch.dirZ * 1.2;
        return {
          x,
          y,
          z,
          isClimbingTree: false,
          isOnBranch: true,
          isPerchedOnBranch: false,
          activeBranch: nearestBranch,
        };
      }
      if (y <= groundY + 0.08 && climbDir < 0) {
        return {
          x,
          y: groundY,
          z,
          isClimbingTree: false,
          isOnBranch: false,
          isPerchedOnBranch: false,
          activeBranch: null,
        };
      }
      return {
        x,
        y: Math.max(groundY, y),
        z,
        isClimbingTree: true,
        isOnBranch: false,
        isPerchedOnBranch: false,
        activeBranch: nearestBranch,
      };
    }
  }

  return {
    x,
    y,
    z,
    isClimbingTree: false,
    isOnBranch: false,
    isPerchedOnBranch: false,
    activeBranch: null,
  };
}

export function executeJaguarBreakoutAndInterrupt(params: {
  jaguarX: number;
  jaguarZ: number;
  isConstricted: boolean;
  isGrabbedByCroc: boolean;
  isPinned: boolean;
  stunTimer: number;
  interruptRadius?: number;
  enemies: Array<{
    id: string;
    x: number;
    z: number;
    isConstricting: boolean;
    isGrabbing: boolean;
    isPinning: boolean;
    isUsingAbility: boolean;
  }>;
}): {
  selfFreed: boolean;
  clearedConstriction: boolean;
  clearedGrab: boolean;
  clearedStun: boolean;
  interruptedEnemyIds: string[];
  stunAppliedSeconds: number;
} {
  const radius = params.interruptRadius ?? 8.5;
  const radiusSq = radius * radius;
  const clearedConstriction = params.isConstricted;
  const clearedGrab = params.isGrabbedByCroc || params.isPinned;
  const clearedStun = params.stunTimer > 0;
  const selfFreed = clearedConstriction || clearedGrab || clearedStun;

  const interruptedEnemyIds: string[] = [];
  for (let i = 0; i < params.enemies.length; i++) {
    const en = params.enemies[i];
    const dx = en.x - params.jaguarX;
    const dz = en.z - params.jaguarZ;
    if (dx * dx + dz * dz <= radiusSq) {
      if (en.isConstricting || en.isGrabbing || en.isPinning || en.isUsingAbility || selfFreed) {
        interruptedEnemyIds.push(en.id);
      }
    }
  }

  return {
    selfFreed,
    clearedConstriction,
    clearedGrab,
    clearedStun,
    interruptedEnemyIds,
    stunAppliedSeconds: 2.6,
  };
}

export function toggleMouthCarryPreyState(params: {
  carrierX: number;
  carrierY: number;
  carrierZ: number;
  carrierYaw: number;
  carrierWeight: number;
  currentlyCarriedId: string | null;
  candidates: ReadonlyArray<{
    id: string;
    x: number;
    y: number;
    z: number;
    weight: number;
    isDead: boolean;
    isSubduedOrPinned: boolean;
  }>;
  maxGrabRange?: number;
}): {
  carriedId: string | null;
  action: 'grabbed' | 'dropped' | 'none';
  carriedPos: { x: number; y: number; z: number } | null;
} {
  const mouthOffset = 1.45;
  const mouthPos = {
    x: Number((params.carrierX + Math.sin(params.carrierYaw) * mouthOffset).toFixed(3)),
    y: Number((params.carrierY + 0.35).toFixed(3)),
    z: Number((params.carrierZ + Math.cos(params.carrierYaw) * mouthOffset).toFixed(3)),
  };

  if (params.currentlyCarriedId) {
    return {
      carriedId: null,
      action: 'dropped',
      carriedPos: {
        x: mouthPos.x,
        y: params.carrierY,
        z: mouthPos.z,
      },
    };
  }

  const maxRange = params.maxGrabRange ?? 3.8;
  let bestId: string | null = null;
  let bestDist = maxRange;

  for (let i = 0; i < params.candidates.length; i++) {
    const c = params.candidates[i];
    // Can carry dead carcasses up to 1.8x carrier weight, or live/subdued prey up to 1.25x carrier weight
    const maxCarryW = c.isDead ? params.carrierWeight * 1.8 : params.carrierWeight * 1.25;
    if (c.weight > maxCarryW && !c.isSubduedOrPinned) continue;
    const d = Math.hypot(c.x - params.carrierX, c.z - params.carrierZ);
    if (d <= bestDist && Math.abs(c.y - params.carrierY) <= 3.0) {
      bestDist = d;
      bestId = c.id;
    }
  }

  if (bestId) {
    return {
      carriedId: bestId,
      action: 'grabbed',
      carriedPos: mouthPos,
    };
  }

  return {
    carriedId: null,
    action: 'none',
    carriedPos: null,
  };
}

export type AudioGroupName = 'ambience' | 'animals' | 'footsteps' | 'ui';
export type FootstepSurfaceType = 'dirt' | 'mud' | 'shallow_water' | 'leaves';

export interface AudioEventConfig {
  group: AudioGroupName;
  files: ReadonlyArray<string>;
  baseVolume: number;
  refDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  loop?: boolean;
}

export const AUDIO_SOUND_MANIFEST: Readonly<Record<string, AudioEventConfig>> = {
  // 1. Ambience loops & environmental calls
  ambience_day: {
    group: 'ambience',
    files: [
      'audio/ambience_forest_day_01.ogg',
      'audio/ambience_forest_day_02.ogg',
      'audio/ambience_forest_day_03.ogg',
    ],
    baseVolume: 0.55,
    refDistance: 10,
    maxDistance: 1000,
    rolloffFactor: 0,
    loop: true,
  },
  ambience_night: {
    group: 'ambience',
    files: [
      'audio/ambience_forest_night_01.ogg',
      'audio/ambience_forest_night_02.ogg',
      'audio/ambience_forest_night_03.ogg',
    ],
    baseVolume: 0.55,
    refDistance: 10,
    maxDistance: 1000,
    rolloffFactor: 0,
    loop: true,
  },
  ambience_rain: {
    group: 'ambience',
    files: [
      'audio/ambience_rain_01.ogg',
      'audio/ambience_rain_02.ogg',
      'audio/ambience_rain_03.ogg',
    ],
    baseVolume: 0.65,
    refDistance: 10,
    maxDistance: 1000,
    rolloffFactor: 0,
    loop: true,
  },
  bird: {
    group: 'ambience',
    files: [
      'audio/bird_chirp_01.ogg',
      'audio/bird_chirp_02.ogg',
      'audio/bird_chirp_03.ogg',
      'audio/bird_chirp_04.ogg',
    ],
    baseVolume: 0.45,
    refDistance: 8,
    maxDistance: 95,
    rolloffFactor: 1.4,
  },

  // 2. Animal vocalizations & combat 3D positional events
  howl: {
    group: 'animals',
    files: [
      'audio/wolf_howl_01.ogg',
      'audio/wolf_howl_02.ogg',
      'audio/wolf_howl_03.ogg',
      'audio/wolf_howl_04.ogg',
    ],
    baseVolume: 0.85,
    refDistance: 12,
    maxDistance: 180,
    rolloffFactor: 1.1,
  },
  roar: {
    group: 'animals',
    files: [
      'audio/tiger_roar_01.ogg',
      'audio/tiger_roar_02.ogg',
      'audio/tiger_roar_03.ogg',
      'audio/tiger_roar_04.ogg',
    ],
    baseVolume: 0.95,
    refDistance: 14,
    maxDistance: 200,
    rolloffFactor: 1.0,
  },
  tiger_roar: {
    group: 'animals',
    files: [
      'audio/tiger_roar_01.ogg',
      'audio/tiger_roar_02.ogg',
      'audio/tiger_roar_03.ogg',
      'audio/tiger_roar_04.ogg',
    ],
    baseVolume: 0.95,
    refDistance: 14,
    maxDistance: 200,
    rolloffFactor: 1.0,
  },
  jaguar_roar: {
    group: 'animals',
    files: [
      'audio/jaguar_snarl_01.ogg',
      'audio/jaguar_snarl_02.ogg',
      'audio/jaguar_snarl_03.ogg',
    ],
    baseVolume: 0.90,
    refDistance: 12,
    maxDistance: 165,
    rolloffFactor: 1.1,
  },
  hiss: {
    group: 'animals',
    files: [
      'audio/snake_hiss_01.ogg',
      'audio/snake_hiss_02.ogg',
      'audio/snake_hiss_03.ogg',
      'audio/snake_hiss_04.ogg',
    ],
    baseVolume: 0.78,
    refDistance: 6,
    maxDistance: 65,
    rolloffFactor: 1.6,
  },
  sonic: {
    group: 'animals',
    files: [
      'audio/owl_hoot_01.ogg',
      'audio/owl_hoot_02.ogg',
      'audio/owl_hoot_03.ogg',
    ],
    baseVolume: 0.80,
    refDistance: 10,
    maxDistance: 140,
    rolloffFactor: 1.2,
  },
  sonicsound: {
    group: 'animals',
    files: [
      'audio/owl_hoot_01.ogg',
      'audio/owl_hoot_02.ogg',
      'audio/owl_hoot_03.ogg',
    ],
    baseVolume: 0.80,
    refDistance: 10,
    maxDistance: 140,
    rolloffFactor: 1.2,
  },
  eagle_screech: {
    group: 'animals',
    files: [
      'audio/eagle_screech_01.ogg',
      'audio/eagle_screech_02.ogg',
      'audio/eagle_screech_03.ogg',
    ],
    baseVolume: 0.82,
    refDistance: 14,
    maxDistance: 190,
    rolloffFactor: 1.05,
  },
  croc_bellow: {
    group: 'animals',
    files: [
      'audio/croc_bellow_01.ogg',
      'audio/croc_bellow_02.ogg',
      'audio/croc_bellow_03.ogg',
    ],
    baseVolume: 0.88,
    refDistance: 10,
    maxDistance: 130,
    rolloffFactor: 1.25,
  },
  attack: {
    group: 'animals',
    files: [
      'audio/attack_bite_01.ogg',
      'audio/attack_bite_02.ogg',
      'audio/attack_bite_03.ogg',
      'audio/attack_bite_04.ogg',
    ],
    baseVolume: 0.82,
    refDistance: 7,
    maxDistance: 75,
    rolloffFactor: 1.5,
  },
  hit: {
    group: 'animals',
    files: [
      'audio/hit_impact_01.ogg',
      'audio/hit_impact_02.ogg',
      'audio/hit_impact_03.ogg',
      'audio/hit_impact_04.ogg',
    ],
    baseVolume: 0.88,
    refDistance: 8,
    maxDistance: 85,
    rolloffFactor: 1.4,
  },
  eat: {
    group: 'animals',
    files: [
      'audio/eat_crunch_01.ogg',
      'audio/eat_crunch_02.ogg',
      'audio/eat_crunch_03.ogg',
      'audio/eat_crunch_04.ogg',
    ],
    baseVolume: 0.75,
    refDistance: 6,
    maxDistance: 55,
    rolloffFactor: 1.6,
  },
  leap: {
    group: 'animals',
    files: [
      'audio/leap_whoosh_01.ogg',
      'audio/leap_whoosh_02.ogg',
      'audio/leap_whoosh_03.ogg',
    ],
    baseVolume: 0.72,
    refDistance: 6,
    maxDistance: 60,
    rolloffFactor: 1.5,
  },
  splash: {
    group: 'animals',
    files: [
      'audio/water_splash_01.ogg',
      'audio/water_splash_02.ogg',
      'audio/water_splash_03.ogg',
      'audio/water_splash_04.ogg',
    ],
    baseVolume: 0.84,
    refDistance: 8,
    maxDistance: 95,
    rolloffFactor: 1.35,
  },
  death: {
    group: 'animals',
    files: [
      'audio/animal_death_01.ogg',
      'audio/animal_death_02.ogg',
      'audio/animal_death_03.ogg',
    ],
    baseVolume: 0.90,
    refDistance: 10,
    maxDistance: 110,
    rolloffFactor: 1.2,
  },

  // 3. Surface-dependent Footsteps (dirt, mud, shallow_water, leaves)
  footstep_dirt: {
    group: 'footsteps',
    files: [
      'audio/footstep_dirt_01.ogg',
      'audio/footstep_dirt_02.ogg',
      'audio/footstep_dirt_03.ogg',
      'audio/footstep_dirt_04.ogg',
    ],
    baseVolume: 0.62,
    refDistance: 5,
    maxDistance: 48,
    rolloffFactor: 1.75,
  },
  footstep_mud: {
    group: 'footsteps',
    files: [
      'audio/footstep_mud_01.ogg',
      'audio/footstep_mud_02.ogg',
      'audio/footstep_mud_03.ogg',
      'audio/footstep_mud_04.ogg',
    ],
    baseVolume: 0.68,
    refDistance: 5,
    maxDistance: 50,
    rolloffFactor: 1.7,
  },
  footstep_shallow_water: {
    group: 'footsteps',
    files: [
      'audio/footstep_shallow_water_01.ogg',
      'audio/footstep_shallow_water_02.ogg',
      'audio/footstep_shallow_water_03.ogg',
      'audio/footstep_shallow_water_04.ogg',
    ],
    baseVolume: 0.74,
    refDistance: 6,
    maxDistance: 58,
    rolloffFactor: 1.6,
  },
  footstep_leaves: {
    group: 'footsteps',
    files: [
      'audio/footstep_leaves_01.ogg',
      'audio/footstep_leaves_02.ogg',
      'audio/footstep_leaves_03.ogg',
      'audio/footstep_leaves_04.ogg',
    ],
    baseVolume: 0.60,
    refDistance: 5,
    maxDistance: 46,
    rolloffFactor: 1.75,
  },

  // 4. UI Sounds
  toast: {
    group: 'ui',
    files: [
      'audio/ui_notify_01.ogg',
      'audio/ui_notify_02.ogg',
      'audio/ui_notify_03.ogg',
    ],
    baseVolume: 0.55,
    refDistance: 1,
    maxDistance: 100,
    rolloffFactor: 0,
  },
  ui_click: {
    group: 'ui',
    files: [
      'audio/ui_click_01.ogg',
      'audio/ui_click_02.ogg',
      'audio/ui_click_03.ogg',
    ],
    baseVolume: 0.50,
    refDistance: 1,
    maxDistance: 100,
    rolloffFactor: 0,
  },
  foliage_rustle: {
    group: 'ambience',
    files: [
      'audio/foliage_rustle_01.ogg',
      'audio/foliage_rustle_02.ogg',
      'audio/foliage_rustle_03.ogg',
    ],
    baseVolume: 0.42,
    refDistance: 5,
    maxDistance: 42,
    rolloffFactor: 1.8,
  },
};

export function pickSoundVariantAndModulation(
  files: ReadonlyArray<string>,
  lastVariantIndex = -1,
  randIndex = Math.random(),
  randPitch = Math.random(),
  randVol = Math.random()
): {
  file: string;
  variantIndex: number;
  playbackRate: number;
  volumeMultiplier: number;
} {
  if (files.length === 0) {
    return { file: '', variantIndex: -1, playbackRate: 1.0, volumeMultiplier: 1.0 };
  }
  let idx = Math.min(files.length - 1, Math.max(0, Math.floor(randIndex * files.length)));
  if (files.length > 1 && idx === lastVariantIndex) {
    idx = (idx + 1) % files.length;
  }
  const playbackRate = Number((0.9 + Math.max(0, Math.min(1, randPitch)) * 0.2).toFixed(3));
  const volumeMultiplier = Number((0.9 + Math.max(0, Math.min(1, randVol)) * 0.2).toFixed(3));
  return {
    file: files[idx],
    variantIndex: idx,
    playbackRate,
    volumeMultiplier,
  };
}

export function detectFootstepSurface(params: {
  groundY: number;
  waterLevel: number;
  distToShoreline: number;
  isUnderCanopyOrBush: boolean;
  isInWaterBody: boolean;
}): FootstepSurfaceType {
  const waterDepth = params.waterLevel - params.groundY;
  if (params.isInWaterBody && waterDepth > -0.08 && waterDepth <= 0.85) {
    return 'shallow_water';
  }
  if (
    params.distToShoreline <= 3.8 ||
    (params.groundY >= params.waterLevel - 0.15 && params.groundY <= params.waterLevel + 0.55)
  ) {
    return 'mud';
  }
  if (params.isUnderCanopyOrBush) {
    return 'leaves';
  }
  return 'dirt';
}

export function computeFootstepDynamics(params: {
  species: string;
  speed: number;
  currentWeight: number;
  surface: FootstepSurfaceType;
  isSneaking?: boolean;
}): {
  soundKey: string;
  stepInterval: number;
  playbackRate: number;
  volume: number;
} {
  const effectiveSpeed = Math.max(0.5, params.speed);
  // Normalize weight on a log scale from 1.5kg (rabbit/snake) up to 350kg (adult tiger/crocodile/anaconda)
  const clampedW = Math.max(1.5, Math.min(400, params.currentWeight));
  const massFactor = Math.max(0, Math.min(1, (Math.log(clampedW) - Math.log(1.5)) / (Math.log(350) - Math.log(1.5))));

  // Larger/heavier animals have longer stride intervals (slower cadence) and heavier/deeper steps;
  // Higher velocity shortens the interval between steps.
  const baseStrideMeters = 1.15 + massFactor * 1.65;
  const rawInterval = baseStrideMeters / effectiveSpeed;
  const stepInterval = Number(Math.max(0.18, Math.min(1.35, rawInterval)).toFixed(3));

  // Heavy animals have lower playbackRate (deeper thud ~0.78-0.90), small animals higher (~0.98-1.08)
  const playbackRate = Number((1.06 - massFactor * 0.26).toFixed(3));

  // Volume scales with both animal weight and movement velocity, reduced when sneaking
  const speedVolFactor = Math.max(0.45, Math.min(1.25, 0.5 + effectiveSpeed / 11.0));
  const massVolFactor = 0.42 + massFactor * 0.68;
  const sneakFactor = params.isSneaking ? 0.35 : 1.0;
  const volume = Number(Math.max(0.08, Math.min(1.0, massVolFactor * speedVolFactor * sneakFactor)).toFixed(3));

  return {
    soundKey: `footstep_${params.surface}`,
    stepInterval,
    playbackRate,
    volume,
  };
}

export function computeUnderwaterLowpassFrequency(params: {
  isDiving: boolean;
  isSubmerged: boolean;
  underwaterDepth?: number;
}): {
  filterEnabled: boolean;
  cutoffHz: number;
} {
  if (params.isDiving || params.isSubmerged) {
    const depth = Math.max(0, params.underwaterDepth ?? 1.0);
    // Clamp cutoff frequency strictly inside the 500-800 Hz underwater lowpass band
    const cutoffHz = Math.round(Math.max(500, Math.min(800, 760 - depth * 85)));
    return {
      filterEnabled: true,
      cutoffHz,
    };
  }
  return {
    filterEnabled: false,
    cutoffHz: 20000,
  };
}

export function computeAmbienceCrossfadeState(params: {
  dayProgress: number; // 0..1 across day/night cycle, where sin(dayProgress * 2pi) > 0 is daytime
  weather: string;
  ambienceGroupVolume: number;
  masterVolume: number;
  isMuted: boolean;
}): {
  dayFactor: number;
  dayGain: number;
  nightGain: number;
  rainGain: number;
} {
  const sunWave = Math.sin(params.dayProgress * Math.PI * 2);
  // Smooth crossfade around dawn & dusk
  const dayFactor = Number(Math.max(0, Math.min(1, 0.5 + sunWave * 0.65)).toFixed(3));
  if (params.isMuted || params.masterVolume <= 0.001 || params.ambienceGroupVolume <= 0.001) {
    return { dayFactor, dayGain: 0, nightGain: 0, rainGain: 0 };
  }
  const busGain = Math.max(0, Math.min(1, params.masterVolume)) * Math.max(0, Math.min(1, params.ambienceGroupVolume));
  const isRaining = params.weather === 'rain' || params.weather === 'first_summer_rain';
  const rainDuck = isRaining ? 0.78 : 1.0;

  const dayGain = Number((dayFactor * 0.55 * busGain * rainDuck).toFixed(3));
  const nightGain = Number(((1 - dayFactor) * 0.55 * busGain * rainDuck).toFixed(3));
  const rainGain = isRaining ? Number((0.68 * busGain).toFixed(3)) : 0;

  return {
    dayFactor,
    dayGain,
    nightGain,
    rainGain,
  };
}

export type VegetationLayerKey =
  | 'tall_canopy_tree'
  | 'mid_tree'
  | 'low_bush'
  | 'fern'
  | 'tall_grass'
  | 'vine'
  | 'reeds_water_hyacinth'
  | 'flooded_mangrove_tree';

export const VEGETATION_LAYER_KEYS: ReadonlyArray<VegetationLayerKey> = [
  'tall_canopy_tree',
  'mid_tree',
  'low_bush',
  'fern',
  'tall_grass',
  'vine',
  'reeds_water_hyacinth',
  'flooded_mangrove_tree',
];

export function biomeFbmNoise(x: number, z: number): number {
  const n1 = Math.sin(x * 0.018 + z * 0.014) * Math.cos(z * 0.021 - x * 0.011);
  const n2 = Math.sin(x * 0.043 - z * 0.037 + 1.7) * 0.5;
  const n3 = Math.cos(x * 0.089 + z * 0.076 - 0.9) * 0.25;
  const raw = (n1 + n2 + n3) / 1.75; // -1..1
  return Number(Math.max(0, Math.min(1, 0.5 + raw * 0.55)).toFixed(4));
}

export function evaluateVegetationBiomeAt(params: {
  x: number;
  z: number;
  groundY: number;
  waterLevel?: number;
  distToShoreline: number;
}): {
  biome: 'deep_water' | 'riverbank_wetland' | 'dense_forest' | 'clearing';
  noiseVal: number;
  canPlaceTrees: boolean;
  allowedLayers: VegetationLayerKey[];
} {
  const waterLevel = params.waterLevel ?? WATER;
  const noiseVal = biomeFbmNoise(params.x, params.z);

  // Never place trees or terrestrial plants in deep water!
  if (params.groundY < waterLevel - 0.85) {
    return {
      biome: 'deep_water',
      noiseVal,
      canPlaceTrees: false,
      allowedLayers: [],
    };
  }

  // Riverbank & shallow water margin: reeds, water hyacinth, tall grass, and flooded riverbank mangrove trees
  if (
    params.distToShoreline <= 11.5 ||
    (params.groundY >= waterLevel - 0.85 && params.groundY <= waterLevel + 0.95)
  ) {
    const allowed: VegetationLayerKey[] = [
      'reeds_water_hyacinth',
      'tall_grass',
      'flooded_mangrove_tree',
      'low_bush',
    ];
    return {
      biome: 'riverbank_wetland',
      noiseVal,
      canPlaceTrees: params.groundY >= waterLevel - 0.65,
      allowedLayers: allowed,
    };
  }

  // Higher ground with high noise forms dense forest patches (tall canopy trees, mid trees, vines, ferns, low bushes)
  if (params.groundY > waterLevel + 0.95 && noiseVal >= 0.44) {
    return {
      biome: 'dense_forest',
      noiseVal,
      canPlaceTrees: true,
      allowedLayers: [
        'tall_canopy_tree',
        'mid_tree',
        'low_bush',
        'fern',
        'tall_grass',
        'vine',
      ],
    };
  }

  // Low noise areas form natural open clearings / meadows with sparse grass, ferns, and bushes
  return {
    biome: 'clearing',
    noiseVal,
    canPlaceTrees: noiseVal > 0.36,
    allowedLayers: ['tall_grass', 'fern', 'low_bush'],
  };
}

export function evaluateChunkLODState(params: {
  chunkCenterX: number;
  chunkCenterZ: number;
  playerX: number;
  playerZ: number;
  highDetailRadius?: number;
  cullRadius?: number;
}): {
  visible: boolean;
  lodTier: 'high' | 'medium' | 'culled';
  distance: number;
} {
  const highR = params.highDetailRadius ?? 135;
  const cullR = params.cullRadius ?? 245;
  const dist = Number(Math.hypot(params.chunkCenterX - params.playerX, params.chunkCenterZ - params.playerZ).toFixed(2));
  if (dist > cullR) {
    return { visible: false, lodTier: 'culled', distance: dist };
  }
  if (dist <= highR) {
    return { visible: true, lodTier: 'high', distance: dist };
  }
  return { visible: true, lodTier: 'medium', distance: dist };
}

export function computeConcealmentAndFoliageInteraction(params: {
  coverOverlapRatio: number; // 0 (none) to 1 (center of dense bush/tall grass/reeds)
  coverType?: string | null;
  isSneaking?: boolean;
  isInCave?: boolean;
  isInNest?: boolean;
  isPerchedOnBranch?: boolean;
  isCamouflaged?: boolean;
  animalWeightKg?: number;
  movementSpeed?: number;
}): {
  concealment: number; // 0..1
  speedMultiplier: number;
  triggersRustleSound: boolean;
  rustleVolume: number;
} {
  let c = Math.max(0, Math.min(1, params.coverOverlapRatio)) * 0.72;
  if (params.coverType === 'land_bush' || params.coverType === 'low_bush') {
    c = Math.max(c, Math.min(1, params.coverOverlapRatio * 0.82));
  } else if (params.coverType === 'tall_grass' || params.coverType === 'high_grass' || params.coverType === 'reeds') {
    c = Math.max(c, Math.min(1, params.coverOverlapRatio * 0.76));
  } else if (params.coverType === 'fern') {
    c = Math.max(c, Math.min(1, params.coverOverlapRatio * 0.58));
  }

  if (params.isSneaking) c += 0.18;
  if (params.isInNest) c = Math.max(c, 0.78);
  if (params.isInCave) c = Math.max(c, 0.85);
  if (params.isPerchedOnBranch) c = Math.max(c, 0.72);
  if (params.isCamouflaged) c = 1.0;

  const concealment = Number(Math.max(0, Math.min(1, c)).toFixed(3));
  const weight = params.animalWeightKg ?? 25;
  const speed = params.movementSpeed ?? 0;

  // Large animals (weight >= 65kg) moving through dense bushes/tall grass are slowed down slightly
  let speedMultiplier = 1.0;
  if (params.coverOverlapRatio >= 0.35 && weight >= 65) {
    const heavyFactor = Math.min(1, (weight - 65) / 220);
    speedMultiplier = Number((1.0 - (0.06 + heavyFactor * 0.10) * Math.min(1, params.coverOverlapRatio)).toFixed(3));
  }

  const triggersRustleSound = params.coverOverlapRatio >= 0.32 && speed > 0.55;
  const rustleVolume = triggersRustleSound
    ? Number(Math.max(0.08, Math.min(0.65, 0.15 + (speed / 12) * 0.3 + Math.min(1, weight / 200) * 0.2)).toFixed(3))
    : 0;

  return {
    concealment,
    speedMultiplier,
    triggersRustleSound,
    rustleVolume,
  };
}

export function evaluateCanStartSleep(params: {
  nearestPredatorDist: number;
  minSafePredatorDist?: number;
  inDeepWater: boolean;
  isDiving: boolean;
  isBleedingOrPoisoned: boolean;
  isConstricted: boolean;
  energy: number;
  hydrate: number;
}): {
  canSleep: boolean;
  reasonVi: string;
} {
  const safeDist = params.minSafePredatorDist ?? 26.0;
  if (params.isConstricted) {
    return { canSleep: false, reasonVi: 'Không thể ngủ khi đang bị khống chế!' };
  }
  if (params.inDeepWater || params.isDiving) {
    return { canSleep: false, reasonVi: 'Không thể ngủ khi đang ở vùng nước sâu!' };
  }
  if (params.isBleedingOrPoisoned) {
    return { canSleep: false, reasonVi: 'Không thể ngủ khi đang bị thương chảy máu hoặc trúng độc!' };
  }
  if (params.energy < 15 || params.hydrate < 15) {
    return { canSleep: false, reasonVi: 'Không thể ngủ khi Đói hoặc Khát ở mức nguy kịch (<15)!' };
  }
  if (params.nearestPredatorDist < safeDist) {
    return {
      canSleep: false,
      reasonVi: `Nguy hiểm! Có kẻ săn mồi trong bán kính ${Math.round(params.nearestPredatorDist)}m (<${safeDist}m)!`,
    };
  }
  return { canSleep: true, reasonVi: 'An toàn để ngủ' };
}

export function isSpeciesNocturnal(species: string): boolean {
  return species === 'owl' || species === 'jaguar' || species === 'wolf' || species === 'snake';
}

export function computeSleepStepState(params: {
  species: string;
  currentWeight: number;
  isDaytime: boolean;
  concealment: number;
  inNestOrCave: boolean;
  nearestPredatorDist: number;
  wasAttacked: boolean;
  loudSoundDist: number;
  wantsMoveOrToggleWake: boolean;
  dt: number;
}): {
  isNocturnal: boolean;
  timeOfDayMultiplier: number;
  sizeRecoveryMultiplier: number;
  staminaGain: number;
  hpGain: number;
  energyDrainMultiplier: number;
  hydrateDrainMultiplier: number;
  timeScale: number;
  aiDetectionMultiplier: number;
  visionMultiplier: number;
  hearingCutoffHz: number;
  shouldWakeUp: boolean;
  forcedThreatWake: boolean;
  groggyWakePenaltySeconds: number;
} {
  const isNocturnal = isSpeciesNocturnal(params.species);
  // Nocturnal species (Owl, Jaguar, Wolf, Snake) recover better when sleeping during the day;
  // Diurnal species recover better when sleeping at night.
  const timeOfDayMultiplier = isNocturnal
    ? (params.isDaytime ? 1.35 : 0.85)
    : (!params.isDaytime ? 1.30 : 0.90);

  // Larger/heavier species recover slower per second so they require longer sleep
  const clampedW = Math.max(1.5, Math.min(380, params.currentWeight));
  const massNorm = Math.max(0, Math.min(1, (Math.log(clampedW) - Math.log(1.5)) / (Math.log(350) - Math.log(1.5))));
  const sizeRecoveryMultiplier = Number((1.22 - massNorm * 0.54).toFixed(3)); // ~1.22 for rabbit, ~0.68 for heavy tiger/croc

  const isSafeConcealed = params.concealment >= 0.45 || params.inNestOrCave;
  const threatNearby = params.nearestPredatorDist <= 34.0;
  // Fast-forward time when sleeping safely; freeze fast-forward immediately if a threat is nearby
  const timeScale = (!threatNearby && isSafeConcealed) ? 3.0 : (!threatNearby ? 1.8 : 1.0);

  const effectiveDt = params.dt * timeScale;
  const staminaGain = Number((14.0 * sizeRecoveryMultiplier * timeOfDayMultiplier * effectiveDt).toFixed(3));
  const hpGain = Number((4.2 * sizeRecoveryMultiplier * timeOfDayMultiplier * effectiveDt).toFixed(3));

  // AI detects exposed sleeping player much more easily (1.45x), but concealed/nested sleeping player is hard to spot (0.25x)
  const aiDetectionMultiplier = isSafeConcealed
    ? 0.25
    : (params.concealment >= 0.25 ? 0.85 : 1.45);

  const forcedThreatWake =
    params.wasAttacked ||
    params.loudSoundDist <= 20.0 ||
    params.nearestPredatorDist <= 13.5;
  const shouldWakeUp = Boolean(params.wantsMoveOrToggleWake || forcedThreatWake);
  const groggyWakePenaltySeconds = forcedThreatWake ? 1.6 : 0;

  return {
    isNocturnal,
    timeOfDayMultiplier,
    sizeRecoveryMultiplier,
    staminaGain,
    hpGain,
    energyDrainMultiplier: 0.35,
    hydrateDrainMultiplier: 0.35,
    timeScale,
    aiDetectionMultiplier,
    visionMultiplier: 0.25,
    hearingCutoffHz: 1150,
    shouldWakeUp,
    forcedThreatWake,
    groggyWakePenaltySeconds,
  };
}



