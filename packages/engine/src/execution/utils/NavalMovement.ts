import { TileRef } from "@closefront/engine-api/game/GameMap";
import { UnitType } from "@closefront/engine-api/game/GameTypes";
import { PseudoRandom } from "@closefront/engine-lib/PseudoRandom";
import { Game, Unit } from "../../game/Game";

/** A random water tile within `radius` of `center`, in the same water body as `from`. */
export function randomWaterTileNear(
  mg: Game,
  random: PseudoRandom,
  from: TileRef,
  center: TileRef | undefined,
  radius: number,
): TileRef | undefined {
  if (center === undefined || !mg.isValidRef(center)) return undefined;
  const component = mg.getWaterComponent(from);
  for (let i = 0; i < 20; i++) {
    const x = mg.x(center) + random.nextInt(-radius, radius + 1);
    const y = mg.y(center) + random.nextInt(-radius, radius + 1);
    if (!mg.isValidCoord(x, y)) continue;
    const t = mg.ref(x, y);
    if (!mg.isWater(t)) continue;
    if (component !== null && !mg.hasWaterComponent(t, component)) continue;
    return t;
  }
  return undefined;
}

/** A water tile about `dist` tiles from `from`, directly away from `threat`. */
export function tileAwayFrom(
  mg: Game,
  from: TileRef,
  threat: TileRef,
  dist: number,
): TileRef | undefined {
  const dx = mg.x(from) - mg.x(threat);
  const dy = mg.y(from) - mg.y(threat);
  const len = Math.abs(dx) + Math.abs(dy);
  if (len === 0) return undefined;
  const component = mg.getWaterComponent(from);
  // Fall back to shorter hops when the full one lands on land or off the map.
  for (let d = dist; d >= 1; d = Math.floor(d / 2)) {
    const x = mg.x(from) + Math.trunc((dx * d) / len);
    const y = mg.y(from) + Math.trunc((dy * d) / len);
    if (!mg.isValidCoord(x, y)) continue;
    const t = mg.ref(x, y);
    if (t === from || !mg.isWater(t)) continue;
    if (component !== null && !mg.hasWaterComponent(t, component)) continue;
    return t;
  }
  return undefined;
}

/** The closest warship within `range` that `unit`'s owner is at war with. */
export function nearestEnemyWarship(
  mg: Game,
  unit: Unit,
  range: number,
): Unit | undefined {
  const owner = unit.owner();
  return mg
    .nearbyUnits(unit.tile(), range, UnitType.Warship)
    .filter(
      ({ unit: u }) =>
        u.owner() !== owner && owner.canAttackPlayer(u.owner(), true),
    )
    .sort((a, b) => a.distSquared - b.distSquared)[0]?.unit;
}

/** How often a ship already under way re-checks for nearby enemy warships. */
const THREAT_CHECK_INTERVAL = 10;

/**
 * Where a sub or carrier should head this tick: back into its patrol zone
 * (e.g. after a move order), away from a nearby enemy warship, on to its
 * current target, or to a fresh patrol point.
 */
export function patrolTarget(
  mg: Game,
  random: PseudoRandom,
  ship: Unit,
  patrolRadius: number,
  threatRange: number,
  fleeDistance: number,
): TileRef | undefined {
  const current = ship.targetTile();
  const patrolTile = ship.warshipState().patrolTile;
  if (patrolTile === undefined || !mg.isValidRef(patrolTile)) return current;
  if (mg.euclideanDistSquared(ship.tile(), patrolTile) > patrolRadius ** 2) {
    return current ?? patrolTile;
  }
  if (current === undefined || mg.ticks() % THREAT_CHECK_INTERVAL === 0) {
    const threat = nearestEnemyWarship(mg, ship, threatRange);
    if (threat !== undefined) {
      const away = tileAwayFrom(mg, ship.tile(), threat.tile(), fleeDistance);
      if (away !== undefined) return away;
    }
  }
  return (
    current ??
    randomWaterTileNear(mg, random, ship.tile(), patrolTile, patrolRadius)
  );
}
