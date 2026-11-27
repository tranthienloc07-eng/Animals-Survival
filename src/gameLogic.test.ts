import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_LIMIT,
  WORLD_SPAWN_LIMIT,
  riverX,
  tributaryZ,
  LAKE_X,
  LAKE_Z,
  HIGH_CANOPY_ZONES,
  isActualWaterBodyAt,
  computeCaveInfluence,
  isPointInCave,
  canOwlTakeoffOnSecondSpace,
  shouldHideWaterRipplesInDeepWater,
  computeCrocodileDiveVelocityY,
  computeTigerCamouflageState,
  canTigerRoarStunSpecies,
  hasClearLineOfSight2D,
  computeNavWaypointAroundObstacles,
  computeSemiAquaticVerticalSwimming,
  canAquaticPredatorStrikeAtShoreline,
  WATER,
  GRAVITY,
  computeGravityStep,
  computeLunarCycleState,
  computeWindState,
  LIFESPAN_SECONDS,
  getSpeciesWeightProfile,
  computeMassAndMetabolismState,
  evaluatePredatorPreyWeightContest,
  calculateBiomassFromWeight,
  evaluateEndgameReproductionEligibility,
  computeSeasonWeatherAndWaterState,
  computeBodyTemperatureStep,
  PHYSIOLOGY_CONFIG,
  thermalPerformance,
  computeLocalWaterTemperature,
  ECOSYSTEM_SPAWN_PLAN,
  isAquaticSpawnWellSpaced,
  canSpeciesClimbTree,
  canSpeciesPerchOnTreeBranch,
  computeTreeClimbAndBranchState,
  executeJaguarBreakoutAndInterrupt,
  toggleMouthCarryPreyState,
  AUDIO_SOUND_MANIFEST,
  pickSoundVariantAndModulation,
  detectFootstepSurface,
  computeFootstepDynamics,
  computeUnderwaterLowpassFrequency,
  computeAmbienceCrossfadeState,
  VEGETATION_LAYER_KEYS,
  biomeFbmNoise,
  evaluateVegetationBiomeAt,
  evaluateChunkLODState,
  computeConcealmentAndFoliageInteraction,
  evaluateCanStartSleep,
  computeSleepStepState,
} from './gameLogic.ts';

describe('Wild Frontier 3D — Core Survival & World Logic', () => {
  it('expands world border and spawn limit properly', () => {
    assert.equal(WORLD_LIMIT, 335);
    assert.equal(WORLD_SPAWN_LIMIT, 315);
    assert.ok(WORLD_SPAWN_LIMIT < WORLD_LIMIT);
  });

  it('allows drinking only at actual water bodies (river, tributary, lake, canopy ponds) and never on dry land', () => {
    assert.equal(isActualWaterBodyAt(riverX(0), 0), true);
    const testX = -150;
    assert.equal(isActualWaterBodyAt(testX, tributaryZ(testX)), true);
    assert.equal(isActualWaterBodyAt(LAKE_X, LAKE_Z), true);
    const pond = HIGH_CANOPY_ZONES[0];
    assert.equal(isActualWaterBodyAt(pond.pondX, pond.pondZ), true);
    assert.equal(isActualWaterBodyAt(-220, -220), false);
    assert.equal(isActualWaterBodyAt(210, 210), false);
  });

  it('creates a smooth descending ramp from cave entrance down to subterranean floor', () => {
    const atMouth = computeCaveInfluence(-140, 30);
    const midTunnel = computeCaveInfluence(-87, 26);
    assert.ok(atMouth.floorY > 1.5, 'Cave entrance starts near surface level');
    assert.ok(midTunnel.floorY < -2.5, 'Cave middle descends deep underground');
    assert.equal(midTunnel.inCave, true);
    assert.ok(isPointInCave(-87, 26) !== null);
  });

  it('triggers Owl flight reliably on double-Space or while airborne', () => {
    assert.equal(canOwlTakeoffOnSecondSpace('owl', false, false, 240, true), true);
    assert.equal(canOwlTakeoffOnSecondSpace('owl', false, false, 900, false), true);
    assert.equal(canOwlTakeoffOnSecondSpace('owl', false, false, 900, true), false);
    assert.equal(canOwlTakeoffOnSecondSpace('owl', true, false, 200, false), false);
    assert.equal(canOwlTakeoffOnSecondSpace('tiger', false, false, 200, true), false);
  });

  it('hides surface water ripples when player enters deep water or dives', () => {
    assert.equal(shouldHideWaterRipplesInDeepWater(0.0, false, 0.2), false);
    assert.equal(shouldHideWaterRipplesInDeepWater(0.45, false, 0.2), true);
    assert.equal(shouldHideWaterRipplesInDeepWater(0.0, true, 0.3), true);
    assert.equal(shouldHideWaterRipplesInDeepWater(0.0, false, 1.1), true);
  });

  it('steers Crocodile 3D diving vertically along camera pitch and Space/C keys', () => {
    const vyDiveDown = computeCrocodileDiveVelocityY(true, true, 1, 0.5, 6.0, false, false);
    assert.ok(vyDiveDown < -2.0);
    const vySwimUp = computeCrocodileDiveVelocityY(true, true, 1, -0.5, 6.0, false, false);
    assert.ok(vySwimUp > 2.0);
    assert.ok(computeCrocodileDiveVelocityY(true, true, 0, 0, 6.0, true, false) > 0);
    assert.ok(computeCrocodileDiveVelocityY(true, true, 0, 0, 6.0, false, true) < 0);
  });

  it('charges Tiger Q camouflage over 5.0s and reduces opacity by 75% (to 0.25) when full', () => {
    const partial = computeTigerCamouflageState(0, 2.5, true, false, false);
    assert.equal(partial.gauge, 2.5);
    assert.equal(partial.isCamouflaged, false);
    assert.ok(partial.opacity > 0.25 && partial.opacity < 1.0);

    const full = computeTigerCamouflageState(partial.gauge, 2.6, true, false, false);
    assert.equal(full.gauge, 5.0);
    assert.equal(full.isCamouflaged, true);
    assert.equal(full.opacity, 0.25);

    const reset = computeTigerCamouflageState(full.gauge, 0.1, false, false, false);
    assert.equal(reset.gauge, 0);
    assert.equal(reset.isCamouflaged, false);
    assert.equal(reset.opacity, 1.0);
  });

  it('ensures Tiger E Roar stuns prey and predators except Anaconda and Crocodile', () => {
    assert.equal(canTigerRoarStunSpecies('deer'), true);
    assert.equal(canTigerRoarStunSpecies('wolf'), true);
    assert.equal(canTigerRoarStunSpecies('eagle'), true);
    assert.equal(canTigerRoarStunSpecies('anaconda'), false);
    assert.equal(canTigerRoarStunSpecies('crocodile'), false);
  });

  it('detects tree/rock obstacles along NPC line-of-sight and computes clear detour waypoints', () => {
    const obstacles = [{ x: 0, z: 3.0, radius: 0.9 }];
    // Direct path from (0,0) to (0,5) is blocked by tree at (0,3)
    assert.equal(hasClearLineOfSight2D(0, 0, 0, 5, obstacles, 0.6), false);

    // Compute bypass waypoint around the blocking tree
    const nav = computeNavWaypointAroundObstacles(0, 0, 0, 5.0, obstacles, 0.6, 1);
    assert.equal(nav.steered, true);
    assert.ok(Math.abs(nav.yaw) > 0.3, 'Deflects yaw around the tree');
    assert.equal(
      hasClearLineOfSight2D(0, 0, nav.waypointX, nav.waypointZ, obstacles, 0.6),
      true,
      'Chosen waypoint path is completely clear of the obstacle'
    );
  });

  it('allows both Anaconda and Crocodile to swim on the surface, dive into deep water, and surface back up', () => {
    const riverBedY = -4.2;
    const anaSurface = computeSemiAquaticVerticalSwimming({
      species: 'anaconda',
      currentY: WATER - 0.18,
      groundY: riverBedY,
      isDiving: false,
      diveTargetY: null,
      inputZ: 1,
      camPitch: 0,
      speed: 5.0,
      spacePressed: false,
      cPressed: false,
      dt: 0.1,
    });
    assert.equal(anaSurface.isDiving, false);
    assert.ok(anaSurface.nextY > WATER - 0.35, 'Anaconda swims near surface by default');

    const anaDive = computeSemiAquaticVerticalSwimming({
      species: 'anaconda',
      currentY: anaSurface.nextY,
      groundY: riverBedY,
      isDiving: false,
      diveTargetY: null,
      inputZ: 1,
      camPitch: 0.45,
      speed: 5.0,
      spacePressed: false,
      cPressed: true,
      dt: 0.2,
    });
    assert.equal(anaDive.isDiving, true);
    assert.equal(anaDive.doveNow, true);
    assert.ok(anaDive.nextY < anaSurface.nextY, 'Anaconda descends into deep water');

    let curY = -2.2;
    let dTarget: number | null = -2.2;
    let diving = true;
    let surfaced = false;
    for (let step = 0; step < 30; step++) {
      const res = computeSemiAquaticVerticalSwimming({
        species: 'anaconda',
        currentY: curY,
        groundY: riverBedY,
        isDiving: diving,
        diveTargetY: dTarget,
        inputZ: 1,
        camPitch: -0.4,
        speed: 5.5,
        spacePressed: true,
        cPressed: false,
        dt: 0.1,
      });
      curY = res.nextY;
      diving = res.isDiving;
      dTarget = res.diveTargetY;
      if (res.surfacedNow) surfaced = true;
      if (!diving) break;
    }
    assert.equal(diving, false, 'Anaconda surfaces back to water top');
    assert.equal(surfaced, true);
  });

  it('validates Crocodile and Anaconda shoreline strikes across riverbank elevation differences', () => {
    assert.equal(
      canAquaticPredatorStrikeAtShoreline(18.0, -2.4, 10.0, 20.5, 0.35, 10.0, 3.1, 3.8),
      true
    );
    assert.equal(
      canAquaticPredatorStrikeAtShoreline(18.0, -2.4, 10.0, 23.5, 0.35, 10.0, 3.1, 3.8),
      false
    );
  });

  it('applies downward gravity acceleration and detects grounded landing accurately', () => {
    assert.equal(GRAVITY, -22.0);
    const step1 = computeGravityStep(5.0, 0, 1.0, 0.1, GRAVITY);
    assert.equal(step1.isGrounded, false);
    assert.ok(step1.nextVelY < 0, 'Gravity accelerates entity downward');
    assert.ok(step1.nextY < 5.0, 'Entity Y position decreases while falling');

    let y = step1.nextY;
    let vy = step1.nextVelY;
    let grounded = false;
    let impactSpeed = 0;
    for (let i = 0; i < 30; i++) {
      const s = computeGravityStep(y, vy, 1.0, 0.05, GRAVITY);
      y = s.nextY;
      vy = s.nextVelY;
      if (s.isGrounded) {
        grounded = true;
        impactSpeed = s.landedImpactSpeed;
        break;
      }
    }
    assert.equal(grounded, true, 'Entity lands on ground');
    assert.equal(y, 1.0, 'Clamped cleanly to groundY');
    assert.equal(vy, 0, 'Vertical velocity resets to 0 on landing');
    assert.ok(impactSpeed > 4.0, 'Records positive landing impact speed');
  });

  it('computes lunar cycle with Full Moon night light and New Moon darkness', () => {
    const newMoon = computeLunarCycleState(0, 240, 0.0);
    assert.equal(newMoon.phaseKey, 'new_moon');
    assert.equal(newMoon.illumination, 0);
    assert.ok(newMoon.nightMoonLightIntensity <= 0.03, 'New moon keeps night dark');
    assert.ok(newMoon.nightAmbientIntensity <= 0.08, 'New moon ambient is very dark');

    const fullMoon = computeLunarCycleState(0, 240, 0.5);
    assert.equal(fullMoon.phaseKey, 'full_moon');
    assert.ok(fullMoon.illumination > 0.99, 'Full moon has 100% illumination');
    assert.ok(
      fullMoon.nightMoonLightIntensity > newMoon.nightMoonLightIntensity * 10,
      'Full moon provides subtle night illumination'
    );
    assert.ok(
      fullMoon.nightAmbientIntensity > newMoon.nightAmbientIntensity * 3,
      'Full moon raises night ambient visibility slightly'
    );
  });

  it('computes dynamic wind vector with gusts and normalized direction', () => {
    const w1 = computeWindState(10.0);
    const w2 = computeWindState(14.5);
    const dirLen = Math.hypot(w1.dirX, w1.dirZ);
    assert.ok(Math.abs(dirLen - 1.0) < 0.001, 'Wind direction vector is normalized');
    assert.ok(w1.speed > 2.0 && w1.speed < 12.0, 'Wind speed stays within natural range');
    assert.notEqual(w1.speed, w2.speed, 'Wind speed varies dynamically with gusts');
    assert.ok(w1.directionLabel.length > 0);
  });

  it('couples TotalMass (CurrentWeight + StomachLoad) with Gravity, Starving, Overstuffed, Belly Bulge, and Digestion Rate', () => {
    const normal = computeMassAndMetabolismState({
      species: 'tiger',
      age: 300,
      energy: 85,
      currentWeight: 220,
      stomachLoad: 0,
      bodyTemp: 37.0,
      dt: 1.0,
    });
    assert.equal(normal.isStarving, false);
    assert.equal(normal.isOverstuffed, false);
    assert.equal(normal.bellyBulgeScale, 1.0);

    // Starving (Energy < 25) reduces movement speed and slows digestion
    const starving = computeMassAndMetabolismState({
      species: 'tiger',
      age: 300,
      energy: 15,
      currentWeight: 220,
      stomachLoad: 0,
      bodyTemp: 37.0,
      dt: 1.0,
    });
    assert.equal(starving.isStarving, true);
    assert.ok(starving.speedMultiplier < normal.speedMultiplier, 'Starving slows movement');
    assert.ok(starving.digestionRate < normal.digestionRate, 'Low energy lowers digestion rate');

    // Overstuffed (Energy > 100 + heavy StomachLoad) slows movement, locks agile animations, swells belly, increases gravity pull, and slows digestion!
    const overstuffed = computeMassAndMetabolismState({
      species: 'tiger',
      age: 300,
      energy: 135,
      currentWeight: 220,
      stomachLoad: 85,
      bodyTemp: 37.0,
      dt: 1.0,
    });
    assert.equal(overstuffed.isOverstuffed, true);
    assert.equal(overstuffed.agileAnimationsLocked, true);
    assert.ok(overstuffed.speedMultiplier < starving.speedMultiplier, 'Overstuffed moves even slower');
    assert.ok(overstuffed.effectiveGravity < normal.effectiveGravity, 'Heavier TotalMass experiences stronger downward gravity');
    assert.ok(overstuffed.bellyBulgeScale > 1.35, 'Belly visually swells when overstuffed');
    assert.ok(overstuffed.digestionRate < normal.digestionRate, 'Overeating slows down digestion rate');
    assert.ok(overstuffed.nextStomachLoad < 85, 'Digests stomach load over time into weight');
    assert.ok(overstuffed.nextWeight > 220, 'Digested food adds to currentWeight');

    // Verify weight and size (modelScale) NEVER increase passively with age/time when no food is eaten (stomachLoad === 0)
    const youngNoFood = computeMassAndMetabolismState({
      species: 'tiger',
      age: 0,
      energy: 100,
      currentWeight: 38,
      stomachLoad: 0,
      bodyTemp: 37.8,
      dt: 10.0,
    });
    const oldNoFood = computeMassAndMetabolismState({
      species: 'tiger',
      age: 600,
      energy: 100,
      currentWeight: 38,
      stomachLoad: 0,
      bodyTemp: 37.8,
      dt: 10.0,
    });
    assert.equal(youngNoFood.nextWeight, 38, 'Weight does not increase without food');
    assert.equal(oldNoFood.nextWeight, 38, 'Age/time never passively increases weight');
    assert.equal(youngNoFood.modelScale, oldNoFood.modelScale, 'Model size never increases from age alone');

    const fedTiger = computeMassAndMetabolismState({
      species: 'tiger',
      age: 60,
      energy: 100,
      currentWeight: 38,
      stomachLoad: 25,
      bodyTemp: 37.8,
      dt: 5.0,
    });
    assert.ok(fedTiger.nextWeight > 38, 'Eating food increases weight');
    assert.ok(fedTiger.modelScale > youngNoFood.modelScale, 'Eating food increases 3D model size');
  });

  it('enforces "Cá Lớn Nuốt Cá Bé" (Big Eats Small) weight contest between Predator and Prey', () => {
    // Small/young wolf (22 kg) attacking a heavy adult deer (115 kg) -> Prey breaks free & counter-attacks!
    const mismatch = evaluatePredatorPreyWeightContest(22, 115);
    assert.equal(mismatch.canSubdue, false);
    assert.equal(mismatch.preyBreaksFree, true);
    assert.ok(mismatch.counterAttackProbability > 0.75, 'Heavy prey has high probability to counter-attack lighter predator');

    // Heavy adult Tiger (260 kg) attacking adult deer (115 kg) -> Easily subdues
    const dominant = evaluatePredatorPreyWeightContest(260, 115);
    assert.equal(dominant.canSubdue, true);
    assert.equal(dominant.preyBreaksFree, false);
    assert.equal(dominant.counterAttackProbability, 0);
  });

  it('validates 15-minute Biomass calculation and 70% ideal weight threshold for reproduction vs malnourished endgame', () => {
    assert.equal(LIFESPAN_SECONDS, 900);
    const tigerProfile = getSpeciesWeightProfile('tiger');
    assert.equal(tigerProfile.minReproductionWeight, 196); // 70% of 280 kg

    // Malnourished at 15 minutes (150 kg < 196 kg) -> Cannot reproduce, triggers malnourished endgame
    const malnourished = evaluateEndgameReproductionEligibility('tiger', 900, 150);
    assert.equal(malnourished.canReproduce, false);
    assert.equal(malnourished.malnourishedEndgame, true);
    assert.equal(malnourished.biomass, calculateBiomassFromWeight(150));

    // Well-fed at 15 minutes (235 kg >= 196 kg) -> Eligible to build nest & reproduce
    const healthy = evaluateEndgameReproductionEligibility('tiger', 900, 235);
    assert.equal(healthy.canReproduce, true);
    assert.equal(healthy.malnourishedEndgame, false);
    assert.equal(healthy.biomass, 235);
  });

  it('simulates 4 Seasons (7 days each), Summer Rain/Drought/First Summer Rain, Winter Snowstorm freeze, and Full Moon High Tide', () => {
    const dayDur = 180;
    // Day 0 -> Spring
    const spring = computeSeasonWeatherAndWaterState({ gameTime: dayDur * 2, dayDuration: dayDur, lunarIllumination: 0.2 });
    assert.equal(spring.season, 'spring');

    // Day 8 -> Summer (days 7..13)
    const summerRain = computeSeasonWeatherAndWaterState({
      gameTime: dayDur * 8,
      dayDuration: dayDur,
      lunarIllumination: 0.2,
      overrideSeason: 'summer',
      overrideEnvTemp: 35.5,
    });
    assert.equal(summerRain.season, 'summer');
    assert.equal(summerRain.weather, 'rain');
    assert.ok(summerRain.waterLevel < WATER, 'Summer 34-37°C rain slightly lowers water level');

    // Summer Drought (>37°C) evaporates water and increases droughtFactor
    const summerDrought = computeSeasonWeatherAndWaterState({
      gameTime: dayDur * 9,
      dayDuration: dayDur,
      lunarIllumination: 0.2,
      overrideSeason: 'summer',
      overrideEnvTemp: 40.2,
    });
    assert.equal(summerDrought.weather, 'drought');
    assert.ok(summerDrought.droughtFactor > 0.6);
    assert.ok(summerDrought.waterLevel < summerRain.waterLevel, 'Drought evaporates water further');

    // Event: "The First Summer Rain" restores lush greenery and raises water level
    const firstRain = computeSeasonWeatherAndWaterState({
      gameTime: dayDur * 11,
      dayDuration: dayDur,
      lunarIllumination: 0.2,
      overrideSeason: 'summer',
      overrideWeather: 'first_summer_rain',
    });
    assert.equal(firstRain.lushFactor, 1.0);
    assert.ok(firstRain.waterLevel > WATER + 0.4, 'First Summer Rain raises water level');

    // Winter Event: "Snowstorm" drops envTemp below -8°C and freezes river 100%
    const snowstorm = computeSeasonWeatherAndWaterState({
      gameTime: dayDur * 24,
      dayDuration: dayDur,
      lunarIllumination: 0.2,
      overrideSeason: 'winter',
      overrideWeather: 'snowstorm',
    });
    assert.equal(snowstorm.season, 'winter');
    assert.equal(snowstorm.weather, 'snowstorm');
    assert.ok(snowstorm.envTemp < -8.0, 'Snowstorm drops envTemp below -8°C');
    assert.equal(snowstorm.iceCoverage, 1.0, 'Snowstorm freezes river & ponds completely');

    // Full Moon raises water level (flooding low areas)
    const fullMoonSpring = computeSeasonWeatherAndWaterState({
      gameTime: dayDur * 2,
      dayDuration: dayDur,
      lunarIllumination: 1.0,
    });
    assert.ok(fullMoonSpring.waterLevel > spring.waterLevel + 0.7, 'Full moon raises water level significantly');
  });

  it('simulates Body Temperature hyperthermia under Summer sun and hypothermia in Winter Snowstorm', () => {
    // Exposed to 41°C Summer sun -> bodyTemp rises above 39.6°C
    let bodyT = 37.0;
    let hyper = false;
    for (let i = 0; i < 40; i++) {
      const step = computeBodyTemperatureStep({
        currentBodyTemp: bodyT,
        envTemp: 41.0,
        waterTemp: 28.0,
        inWater: false,
        isExposedToSun: true,
        inCaveOrShade: false,
        isSprinting: true,
        dt: 1.0,
      });
      bodyT = step.nextBodyTemp;
      hyper = step.isHyperthermic;
    }
    assert.equal(hyper, true, 'Prolonged exposure to scorching Summer sun triggers hyperthermia');

    // Exposed to -14°C Winter Snowstorm -> bodyTemp drops below 34.2°C
    bodyT = 37.0;
    let hypo = false;
    for (let i = 0; i < 40; i++) {
      const step = computeBodyTemperatureStep({
        currentBodyTemp: bodyT,
        envTemp: -14.0,
        waterTemp: -1.5,
        inWater: false,
        isExposedToSun: false,
        inCaveOrShade: false,
        isSprinting: false,
        dt: 1.0,
      });
      bodyT = step.nextBodyTemp;
      hypo = step.isHypothermic;
    }
    assert.equal(hypo, true, 'Winter Snowstorm chill triggers hypothermia');
  });

  it('balances ecosystem spawn rates with abundant snakes and well-spaced crocodiles & anacondas', () => {
    const snakeEntry = ECOSYSTEM_SPAWN_PLAN.find((e) => e.species === 'snake');
    const crocEntry = ECOSYSTEM_SPAWN_PLAN.find((e) => e.species === 'crocodile');
    const anaEntry = ECOSYSTEM_SPAWN_PLAN.find((e) => e.species === 'anaconda');

    assert.ok(snakeEntry && crocEntry && anaEntry);
    assert.ok(snakeEntry.count >= 35, 'Snake spawn count is high so snakes are commonly encountered');
    assert.ok(
      snakeEntry.count >= (crocEntry.count + anaEntry.count) * 1.8,
      'Snakes outnumber combined crocodiles and anacondas'
    );
    assert.ok(crocEntry.count <= 12 && anaEntry.count <= 10, 'Crocodiles and anacondas do not overcrowd the river');

    const placedAquatics = [
      { x: 10, z: -120 },
      { x: -15, z: 0 },
      { x: 12, z: 140 },
    ];
    assert.equal(
      isAquaticSpawnWellSpaced(-10, 10, placedAquatics, 45.0),
      false,
      'Rejects crocodile/anaconda spawn too close to an existing aquatic predator in the same river area'
    );
    assert.equal(
      isAquaticSpawnWellSpaced(-12, -60, placedAquatics, 45.0),
      true,
      'Accepts crocodile/anaconda spawn when well separated along the river'
    );
  });

  it('keeps modelScale reasonable (<= 0.96) and only activates bellyBulgeScale when stomachLoad > 0', () => {
    const fullEnergyNoStomach = computeMassAndMetabolismState({
      species: 'jaguar',
      age: 100,
      energy: 100,
      currentWeight: 85,
      stomachLoad: 0,
      bodyTemp: 37.5,
      dt: 0.1,
    });
    assert.equal(fullEnergyNoStomach.bellyBulgeScale, 1.0, 'No belly bloat when stomachLoad is 0 even at 100 energy');
    assert.ok(fullEnergyNoStomach.modelScale <= 0.96, 'Model scale stays reasonable and never oversized');

    const maxGrown = computeMassAndMetabolismState({
      species: 'tiger',
      age: 500,
      energy: 95,
      currentWeight: 350,
      stomachLoad: 0,
      bodyTemp: 37.5,
      dt: 0.1,
    });
    assert.ok(maxGrown.modelScale <= 0.96, 'Even max-weight adult never exceeds 0.96 scale');
  });

  it('allows Snake, Anaconda, and Jaguar to climb trees onto protruding branches, and Eagle/Owl to perch on branches', () => {
    assert.equal(canSpeciesClimbTree('jaguar'), true);
    assert.equal(canSpeciesClimbTree('snake'), true);
    assert.equal(canSpeciesClimbTree('anaconda'), true);
    assert.equal(canSpeciesClimbTree('deer'), false);
    assert.equal(canSpeciesPerchOnTreeBranch('eagle'), true);
    assert.equal(canSpeciesPerchOnTreeBranch('owl'), true);

    const sampleBranch = {
      id: 'tree-river-1-b0',
      treeX: -30,
      treeZ: 15,
      trunkRadius: 0.9,
      startX: -30,
      startZ: 15,
      endX: -24,
      endZ: 15,
      y: 6.2,
      dirX: 1,
      dirZ: 0,
      length: 6.0,
      radius: 0.45,
    };

    // Jaguar climbs up the trunk toward the branch
    let state = computeTreeClimbAndBranchState({
      species: 'jaguar',
      x: -29.0,
      y: 0.5,
      z: 15,
      groundY: 0.5,
      inputZ: 1,
      spacePressed: true,
      cPressed: false,
      isClimbingTree: false,
      isOnBranch: false,
      activeBranch: null,
      branches: [sampleBranch],
      climbSpeed: 5.5,
      dt: 0.2,
    });
    assert.equal(state.isClimbingTree, true, 'Jaguar engages vertical trunk climbing');
    assert.ok(state.y > 0.5, 'Jaguar ascends vertically up the trunk');

    // Climb all the way onto the branch
    for (let step = 0; step < 15; step++) {
      state = computeTreeClimbAndBranchState({
        species: 'jaguar',
        x: state.x,
        y: state.y,
        z: state.z,
        groundY: 0.5,
        inputZ: 1,
        spacePressed: true,
        cPressed: false,
        isClimbingTree: state.isClimbingTree,
        isOnBranch: state.isOnBranch,
        activeBranch: state.activeBranch,
        branches: [sampleBranch],
        climbSpeed: 5.5,
        dt: 0.2,
      });
      if (state.isOnBranch) break;
    }
    assert.equal(state.isOnBranch, true, 'Jaguar steps out onto the protruding branch');
    assert.ok(Math.abs(state.y - (sampleBranch.y + 0.18)) < 0.05);

    // Eagle perches on the branch
    const eaglePerch = computeTreeClimbAndBranchState({
      species: 'eagle',
      x: -26.5,
      y: 6.5,
      z: 15.2,
      groundY: 0.5,
      inputZ: 0,
      spacePressed: false,
      cPressed: false,
      isClimbingTree: false,
      isOnBranch: false,
      activeBranch: null,
      branches: [sampleBranch],
      climbSpeed: 4.0,
      dt: 0.1,
    });
    assert.equal(eaglePerch.isPerchedOnBranch, true, 'Eagle perches on high tree branch');
    assert.equal(eaglePerch.isOnBranch, true);
  });

  it('executes Jaguar E instant self-breakout and interrupts nearby enemies', () => {
    const res = executeJaguarBreakoutAndInterrupt({
      jaguarX: 10,
      jaguarZ: 20,
      isConstricted: true,
      isGrabbedByCroc: false,
      isPinned: false,
      stunTimer: 1.5,
      interruptRadius: 8.5,
      enemies: [
        { id: 'anaconda-1', x: 11, z: 20.5, isConstricting: true, isGrabbing: false, isPinning: false, isUsingAbility: true },
        { id: 'croc-1', x: 14, z: 22, isConstricting: false, isGrabbing: true, isPinning: false, isUsingAbility: false },
        { id: 'far-wolf', x: 40, z: 50, isConstricting: false, isGrabbing: false, isPinning: false, isUsingAbility: true },
      ],
    });
    assert.equal(res.selfFreed, true);
    assert.equal(res.clearedConstriction, true);
    assert.equal(res.clearedStun, true);
    assert.deepEqual(res.interruptedEnemyIds, ['anaconda-1', 'croc-1']);
    assert.ok(res.stunAppliedSeconds >= 2.0);
  });

  it('toggles F mouth grab/carry and release for prey and carcasses', () => {
    const grab = toggleMouthCarryPreyState({
      carrierX: 0,
      carrierY: 6.38,
      carrierZ: 0,
      carrierYaw: 0,
      carrierWeight: 95,
      currentlyCarriedId: null,
      candidates: [
        { id: 'caiman-corpse', x: 1.2, y: 6.38, z: 1.1, weight: 80, isDead: true, isSubduedOrPinned: false },
      ],
    });
    assert.equal(grab.action, 'grabbed');
    assert.equal(grab.carriedId, 'caiman-corpse');
    assert.ok(grab.carriedPos !== null);

    const drop = toggleMouthCarryPreyState({
      carrierX: 5,
      carrierY: 6.38,
      carrierZ: 8,
      carrierYaw: 0,
      carrierWeight: 95,
      currentlyCarriedId: grab.carriedId,
      candidates: [],
    });
    assert.equal(drop.action, 'dropped');
    assert.equal(drop.carriedId, null);
    assert.equal(drop.carriedPos?.y, 6.38, 'Drops prey cleanly at current elevation (e.g., on tree branch)');
  });

  it('defines multi-variant audio/<name>.ogg files across ambience, animals, footsteps, and ui groups with 0.9-1.1 playbackRate modulation', () => {
    const groupsSeen = new Set<string>();
    for (const [key, cfg] of Object.entries(AUDIO_SOUND_MANIFEST)) {
      groupsSeen.add(cfg.group);
      assert.ok(cfg.files.length >= 3, `Sound event ${key} has at least 3 .ogg variants`);
      for (const f of cfg.files) {
        assert.ok(f.startsWith('audio/') && f.endsWith('.ogg'), `File ${f} follows audio/<name>.ogg convention`);
      }
    }
    assert.deepEqual(
      Array.from(groupsSeen).sort(),
      ['ambience', 'animals', 'footsteps', 'ui'],
      'Covers all 4 required volume groups (ambience, animals, footsteps, ui)'
    );

    const howlFiles = AUDIO_SOUND_MANIFEST.howl.files;
    const v1 = pickSoundVariantAndModulation(howlFiles, -1, 0.0, 0.0, 0.0);
    const v2 = pickSoundVariantAndModulation(howlFiles, v1.variantIndex, 0.0, 1.0, 1.0);
    assert.notEqual(v1.variantIndex, v2.variantIndex, 'Avoids repeating the exact same variant back-to-back');
    assert.equal(v1.playbackRate, 0.9);
    assert.equal(v2.playbackRate, 1.1);
    assert.ok(v1.volumeMultiplier >= 0.9 && v2.volumeMultiplier <= 1.1);
  });

  it('computes surface-dependent footsteps (dirt, mud, shallow_water, leaves) where heavier animals step slower and deeper', () => {
    assert.equal(
      detectFootstepSurface({
        groundY: -0.9,
        waterLevel: -0.6,
        distToShoreline: 0,
        isUnderCanopyOrBush: false,
        isInWaterBody: true,
      }),
      'shallow_water'
    );
    assert.equal(
      detectFootstepSurface({
        groundY: -0.3,
        waterLevel: -0.6,
        distToShoreline: 1.8,
        isUnderCanopyOrBush: false,
        isInWaterBody: false,
      }),
      'mud'
    );
    assert.equal(
      detectFootstepSurface({
        groundY: 2.5,
        waterLevel: -0.6,
        distToShoreline: 35,
        isUnderCanopyOrBush: true,
        isInWaterBody: false,
      }),
      'leaves'
    );
    assert.equal(
      detectFootstepSurface({
        groundY: 3.0,
        waterLevel: -0.6,
        distToShoreline: 40,
        isUnderCanopyOrBush: false,
        isInWaterBody: false,
      }),
      'dirt'
    );

    const smallRabbitStep = computeFootstepDynamics({
      species: 'rabbit',
      speed: 6.0,
      currentWeight: 2.5,
      surface: 'dirt',
      isSneaking: false,
    });
    const heavyTigerStep = computeFootstepDynamics({
      species: 'tiger',
      speed: 6.0,
      currentWeight: 260,
      surface: 'mud',
      isSneaking: false,
    });
    const fastTigerSprintStep = computeFootstepDynamics({
      species: 'tiger',
      speed: 10.5,
      currentWeight: 260,
      surface: 'mud',
      isSneaking: false,
    });

    assert.equal(smallRabbitStep.soundKey, 'footstep_dirt');
    assert.equal(heavyTigerStep.soundKey, 'footstep_mud');
    assert.ok(
      heavyTigerStep.stepInterval > smallRabbitStep.stepInterval,
      'Larger/heavier animals have slower step cadence at the same velocity'
    );
    assert.ok(
      heavyTigerStep.playbackRate < smallRabbitStep.playbackRate,
      'Larger/heavier animals have deeper (lower playbackRate) footsteps'
    );
    assert.ok(
      heavyTigerStep.volume > smallRabbitStep.volume,
      'Larger/heavier animals have heavier (louder) footsteps'
    );
    assert.ok(
      fastTigerSprintStep.stepInterval < heavyTigerStep.stepInterval,
      'Faster velocity shortens step interval'
    );
  });

  it('applies BiquadFilter lowpass (500-800 Hz) when diving underwater and removes filter when surfacing', () => {
    const divingFilter = computeUnderwaterLowpassFrequency({
      isDiving: true,
      isSubmerged: true,
      underwaterDepth: 1.4,
    });
    assert.equal(divingFilter.filterEnabled, true);
    assert.ok(
      divingFilter.cutoffHz >= 500 && divingFilter.cutoffHz <= 800,
      `Underwater lowpass cutoff (${divingFilter.cutoffHz} Hz) is within 500-800 Hz`
    );

    const surfacedFilter = computeUnderwaterLowpassFrequency({
      isDiving: false,
      isSubmerged: false,
      underwaterDepth: 0,
    });
    assert.equal(surfacedFilter.filterEnabled, false);
    assert.equal(surfacedFilter.cutoffHz, 20000);
  });

  it('crossfades forest ambience smoothly between day and night and layers rain audio when raining', () => {
    const noonClear = computeAmbienceCrossfadeState({
      dayProgress: 0.25, // Noon
      weather: 'clear',
      ambienceGroupVolume: 0.8,
      masterVolume: 0.8,
      isMuted: false,
    });
    assert.ok(noonClear.dayGain > 0.3 && noonClear.nightGain === 0, 'Day forest ambience dominates at noon');
    assert.equal(noonClear.rainGain, 0, 'Rain loop is silent when weather is clear');

    const midnightRain = computeAmbienceCrossfadeState({
      dayProgress: 0.75, // Midnight
      weather: 'rain',
      ambienceGroupVolume: 0.8,
      masterVolume: 0.8,
      isMuted: false,
    });
    assert.ok(midnightRain.nightGain > 0.2 && midnightRain.dayGain === 0, 'Night forest ambience dominates at midnight');
    assert.ok(midnightRain.rainGain > 0.35, 'Rain ambience loop fades in during rain');
  });

  it('distributes all 8 vegetation layers across biomes with noise, forbids deep water trees, and culls distant chunks', () => {
    assert.equal(VEGETATION_LAYER_KEYS.length, 8, 'Defines all 8 required vegetation layers');
    assert.ok(VEGETATION_LAYER_KEYS.includes('tall_canopy_tree'));
    assert.ok(VEGETATION_LAYER_KEYS.includes('mid_tree'));
    assert.ok(VEGETATION_LAYER_KEYS.includes('low_bush'));
    assert.ok(VEGETATION_LAYER_KEYS.includes('fern'));
    assert.ok(VEGETATION_LAYER_KEYS.includes('tall_grass'));
    assert.ok(VEGETATION_LAYER_KEYS.includes('vine'));
    assert.ok(VEGETATION_LAYER_KEYS.includes('reeds_water_hyacinth'));
    assert.ok(VEGETATION_LAYER_KEYS.includes('flooded_mangrove_tree'));

    // 1. Deep water strictly forbids trees and terrestrial layers
    const deepWater = evaluateVegetationBiomeAt({
      x: 0,
      z: 0,
      groundY: WATER - 2.5,
      waterLevel: WATER,
      distToShoreline: 0,
    });
    assert.equal(deepWater.biome, 'deep_water');
    assert.equal(deepWater.canPlaceTrees, false);
    assert.equal(deepWater.allowedLayers.length, 0);

    // 2. Riverbank / shoreline has reeds, water hyacinth, tall grass, and flooded mangrove trees
    const riverbank = evaluateVegetationBiomeAt({
      x: 22,
      z: 10,
      groundY: WATER + 0.2,
      waterLevel: WATER,
      distToShoreline: 2.5,
    });
    assert.equal(riverbank.biome, 'riverbank_wetland');
    assert.ok(riverbank.allowedLayers.includes('reeds_water_hyacinth'));
    assert.ok(riverbank.allowedLayers.includes('tall_grass'));
    assert.ok(riverbank.allowedLayers.includes('flooded_mangrove_tree'));

    // 3. Chunk LOD / Distance culling
    const nearChunk = evaluateChunkLODState({
      chunkCenterX: -40,
      chunkCenterZ: 15,
      playerX: -45,
      playerZ: 10,
      highDetailRadius: 135,
      cullRadius: 245,
    });
    const farChunk = evaluateChunkLODState({
      chunkCenterX: 260,
      chunkCenterZ: 260,
      playerX: -45,
      playerZ: 10,
      highDetailRadius: 135,
      cullRadius: 245,
    });
    assert.equal(nearChunk.visible, true);
    assert.equal(nearChunk.lodTier, 'high');
    assert.equal(farChunk.visible, false);
    assert.equal(farChunk.lodTier, 'culled');
  });

  it('computes getConcealment (0..1), triggers foliage rustle when moving through bushes/tall grass, and slows down large animals', () => {
    const openField = computeConcealmentAndFoliageInteraction({
      coverOverlapRatio: 0,
      coverType: null,
      isSneaking: false,
      animalWeightKg: 220,
      movementSpeed: 6.0,
    });
    assert.equal(openField.concealment, 0);
    assert.equal(openField.speedMultiplier, 1.0);
    assert.equal(openField.triggersRustleSound, false);

    const heavyTigerInBush = computeConcealmentAndFoliageInteraction({
      coverOverlapRatio: 0.9,
      coverType: 'low_bush',
      isSneaking: true,
      animalWeightKg: 240,
      movementSpeed: 4.5,
    });
    const smallRabbitInBush = computeConcealmentAndFoliageInteraction({
      coverOverlapRatio: 0.9,
      coverType: 'low_bush',
      isSneaking: true,
      animalWeightKg: 2.5,
      movementSpeed: 4.5,
    });

    assert.ok(heavyTigerInBush.concealment >= 0.85 && heavyTigerInBush.concealment <= 1.0);
    assert.equal(heavyTigerInBush.triggersRustleSound, true);
    assert.ok(heavyTigerInBush.speedMultiplier < 1.0, 'Large animal is slowed slightly in dense bushes');
    assert.equal(smallRabbitInBush.speedMultiplier, 1.0, 'Small animal moves through bushes without heavy slowdown');
  });

  it('enforces sleep conditions, scales sleep recovery by animal size and nocturnal/diurnal time of day, fast-forwards when safe, and applies groggy wake-up on threat', () => {
    // Cannot sleep with predator nearby, in deep water, bleeding, or critically hungry/thirsty
    assert.equal(
      evaluateCanStartSleep({
        nearestPredatorDist: 14,
        inDeepWater: false,
        isDiving: false,
        isBleedingOrPoisoned: false,
        isConstricted: false,
        energy: 80,
        hydrate: 80,
      }).canSleep,
      false
    );
    assert.equal(
      evaluateCanStartSleep({
        nearestPredatorDist: 55,
        inDeepWater: true,
        isDiving: false,
        isBleedingOrPoisoned: false,
        isConstricted: false,
        energy: 80,
        hydrate: 80,
      }).canSleep,
      false
    );
    assert.equal(
      evaluateCanStartSleep({
        nearestPredatorDist: 55,
        inDeepWater: false,
        isDiving: false,
        isBleedingOrPoisoned: true,
        isConstricted: false,
        energy: 80,
        hydrate: 80,
      }).canSleep,
      false
    );
    assert.equal(
      evaluateCanStartSleep({
        nearestPredatorDist: 55,
        inDeepWater: false,
        isDiving: false,
        isBleedingOrPoisoned: false,
        isConstricted: false,
        energy: 10,
        hydrate: 80,
      }).canSleep,
      false
    );

    // Nocturnal Jaguar/Owl recovers faster during daytime than night; heavy animals recover slower than small animals
    const owlDaySafe = computeSleepStepState({
      species: 'owl',
      currentWeight: 3.2,
      isDaytime: true,
      concealment: 0.8,
      inNestOrCave: true,
      nearestPredatorDist: 80,
      wasAttacked: false,
      loudSoundDist: 99,
      wantsMoveOrToggleWake: false,
      dt: 1.0,
    });
    const owlNightSafe = computeSleepStepState({
      species: 'owl',
      currentWeight: 3.2,
      isDaytime: false,
      concealment: 0.8,
      inNestOrCave: true,
      nearestPredatorDist: 80,
      wasAttacked: false,
      loudSoundDist: 99,
      wantsMoveOrToggleWake: false,
      dt: 1.0,
    });
    const heavyCrocDay = computeSleepStepState({
      species: 'crocodile',
      currentWeight: 260,
      isDaytime: true,
      concealment: 0.8,
      inNestOrCave: true,
      nearestPredatorDist: 80,
      wasAttacked: false,
      loudSoundDist: 99,
      wantsMoveOrToggleWake: false,
      dt: 1.0,
    });

    assert.ok(owlDaySafe.staminaGain > owlNightSafe.staminaGain, 'Nocturnal Owl recovers better during the day');
    assert.ok(owlDaySafe.sizeRecoveryMultiplier > heavyCrocDay.sizeRecoveryMultiplier, 'Large animal recovers slower and needs longer sleep');
    assert.equal(owlDaySafe.timeScale, 3.0, 'Fast-forwards time (3x) when sleeping safely in cover/nest');
    assert.equal(owlDaySafe.aiDetectionMultiplier, 0.25, 'High concealment makes sleeping player hard for AI to detect');
    assert.ok(owlDaySafe.energyDrainMultiplier > 0 && owlDaySafe.energyDrainMultiplier < 1.0, 'Hunger drains slower while sleeping but does not stop');

    // Exposed sleeping player & nearby threat freezes fast-forward and wakes with groggy delay on loud sound / attack
    const exposedThreatened = computeSleepStepState({
      species: 'deer',
      currentWeight: 85,
      isDaytime: false,
      concealment: 0.1,
      inNestOrCave: false,
      nearestPredatorDist: 22,
      wasAttacked: false,
      loudSoundDist: 12, // Loud sound within 20m!
      wantsMoveOrToggleWake: false,
      dt: 1.0,
    });
    assert.equal(exposedThreatened.timeScale, 1.0, 'Freezes time fast-forward when predator threat is nearby');
    assert.equal(exposedThreatened.aiDetectionMultiplier, 1.45, 'AI detects exposed sleeping player more easily');
    assert.equal(exposedThreatened.shouldWakeUp, true, 'Loud nearby sound wakes player automatically');
    assert.ok(exposedThreatened.groggyWakePenaltySeconds > 1.0, 'Applies groggy reaction delay when woken by threat/loud sound');
  });

  it('models inertial heat exchange (water 18x air, mass^-0.33), asymmetric thermalPerformance curve, Q10 ectotherm BMR, and endotherm TNZ/panting', () => {
    assert.ok(
      PHYSIOLOGY_CONFIG.heatExchange.waterExchangeMultiplier >= 10 &&
        PHYSIOLOGY_CONFIG.heatExchange.waterExchangeMultiplier <= 25,
      'Water heat exchange multiplier is 10-25x higher than air'
    );

    // 1. Asymmetric thermalPerformance curve for ectotherm (Crocodile: tMin=11, tOptLow=25.5, tOptHigh=33.8, tMax=39.2)
    assert.equal(thermalPerformance(9.0, 'crocodile'), 0, 'Below tMin causes torpor (0 performance)');
    assert.equal(thermalPerformance(29.0, 'crocodile'), 1.0, 'Inside [tOptLow, tOptHigh] yields 100% performance');
    assert.equal(thermalPerformance(40.0, 'crocodile'), 0, 'Above tMax causes lethal heatstroke (0 performance)');
    const coolPerf = thermalPerformance(20.0, 'crocodile');
    const hotPerf = thermalPerformance(37.5, 'crocodile');
    assert.ok(coolPerf > 0.2 && coolPerf < 1.0, 'Rises smoothly from tMin to tOptLow');
    assert.ok(hotPerf > 0 && hotPerf < 0.4, 'Drops steeply above tOptHigh toward tMax');

    // 2. Water exchange rate is ~18x faster than air, and small animals change temperature faster than heavy adults
    const smallSnakeAir = computeBodyTemperatureStep({
      species: 'snake',
      currentBodyTemp: 28.0,
      envTemp: 15.0,
      waterTemp: 15.0,
      inWater: false,
      isExposedToSun: false,
      inCaveOrShade: false,
      isSprinting: false,
      totalMassKg: 2.5,
      dt: 0.5,
    });
    const heavyCrocAir = computeBodyTemperatureStep({
      species: 'crocodile',
      currentBodyTemp: 28.0,
      envTemp: 15.0,
      waterTemp: 15.0,
      inWater: false,
      isExposedToSun: false,
      inCaveOrShade: false,
      isSprinting: false,
      totalMassKg: 320.0,
      dt: 0.5,
    });
    const heavyCrocWater = computeBodyTemperatureStep({
      species: 'crocodile',
      currentBodyTemp: 28.0,
      envTemp: 15.0,
      waterTemp: 15.0,
      inWater: true,
      isExposedToSun: false,
      inCaveOrShade: false,
      isSprinting: false,
      totalMassKg: 320.0,
      dt: 0.5,
    });

    assert.ok(
      smallSnakeAir.exchangeRate > heavyCrocAir.exchangeRate * 3.0,
      'Lighter animal changes temperature much faster than massive animal (mass^-0.33)'
    );
    assert.ok(
      heavyCrocWater.exchangeRate > heavyCrocAir.exchangeRate * 12.0,
      'Water heat exchange is >12x faster than air'
    );

    // 3. Ectotherm basking in sun raises bodyTemp and Q10 increases BMR when warm vs cold
    const coldCroc = computeBodyTemperatureStep({
      species: 'crocodile',
      currentBodyTemp: 16.0,
      envTemp: 16.0,
      waterTemp: 16.0,
      inWater: false,
      isExposedToSun: false,
      inCaveOrShade: true,
      isSprinting: false,
      totalMassKg: 180,
      dt: 1.0,
    });
    const baskingWarmCroc = computeBodyTemperatureStep({
      species: 'crocodile',
      currentBodyTemp: 30.0,
      envTemp: 26.0,
      waterTemp: 24.0,
      inWater: false,
      isExposedToSun: true,
      inCaveOrShade: false,
      isSprinting: false,
      isBasking: true,
      totalMassKg: 180,
      dt: 1.0,
    });
    assert.ok(
      baskingWarmCroc.bmrEnergyDrainPerSec > coldCroc.bmrEnergyDrainPerSec * 2.0,
      'Ectotherm BMR scales exponentially with Q10 (warm croc burns >2x energy of cold croc)'
    );
    assert.equal(baskingWarmCroc.thermoregulationEnergyDrainPerSec, 0, 'Ectotherm does not burn energy to heat itself');

    // 4. Endotherm burns extra energy outside TNZ and pants (losing hydration + stamina cap) when overheated
    const hotWolf = computeBodyTemperatureStep({
      species: 'wolf',
      currentBodyTemp: 40.2,
      envTemp: 39.0,
      waterTemp: 28.0,
      inWater: false,
      isExposedToSun: true,
      inCaveOrShade: false,
      isSprinting: true,
      totalMassKg: 55,
      energy: 80,
      dt: 1.0,
    });
    assert.ok(hotWolf.thermoregulationEnergyDrainPerSec > 0, 'Endotherm burns extra energy outside thermoneutral zone');
    assert.equal(hotWolf.isPanting, true, 'Overheated endotherm pants to cool down');
    assert.ok(hotWolf.pantingHydrateDrainPerSec > 0, 'Panting increases water loss');
    assert.ok(hotWolf.staminaCapMultiplier < 0.85, 'Panting reduces available stamina cap');

    // 5. Local water temperature varies with depth and flow
    const shallowPondDay = computeLocalWaterTemperature({
      baseWaterTemp: 22.0,
      waterDepth: 0.25,
      isFlowingRiver: false,
      isDaytime: true,
    });
    const deepRiverDay = computeLocalWaterTemperature({
      baseWaterTemp: 22.0,
      waterDepth: 2.8,
      isFlowingRiver: true,
      isDaytime: true,
    });
    assert.ok(shallowPondDay > deepRiverDay + 3.0, 'Shallow still pond is significantly warmer than deep flowing river');
  });
});



