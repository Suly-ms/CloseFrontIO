import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@closefront/engine-api/game/GameTypes";
import { AircraftCarrierExecution } from "@closefront/engine/execution/AircraftCarrierExecution";
import { SAMLauncherExecution } from "@closefront/engine/execution/SAMLauncherExecution";
import { Game, Player, Unit } from "@closefront/engine/game/Game";
import { setup } from "../../util/Setup";
import { expectSnapshotRoundTrip } from "../../util/Snapshot";
import { executeTicks } from "../../util/utils";

const MAP = "half_land_half_ocean";
let game: Game;
let player1: Player;
let player2: Player;

function addCarrier(owner: Player, x: number, y: number): Unit {
  const tile = game.ref(x, y);
  const carrier = owner.buildUnit(UnitType.AircraftCarrier, tile, {
    patrolTile: tile,
  });
  game.addExecution(new AircraftCarrierExecution(carrier));
  return carrier;
}

function addWarship(owner: Player, x: number, y: number): Unit {
  const tile = game.ref(x, y);
  return owner.buildUnit(UnitType.Warship, tile, { patrolTile: tile });
}

/** Ticks until `done` holds, failing after `max` ticks. */
function tickUntil(done: () => boolean, max = 100): void {
  for (let i = 0; i < max && !done(); i++) game.executeNextTick();
  expect(done()).toBe(true);
}

describe("aircraft carrier", () => {
  beforeEach(async () => {
    game = await setup(MAP, { infiniteGold: true, instantBuild: true }, [
      new PlayerInfo("carrier owner", PlayerType.Human, null, "player_1_id"),
      new PlayerInfo("enemy", PlayerType.Human, null, "player_2_id"),
    ]);
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
  });

  it("strikes an enemy warship once per sortie, then rearms", () => {
    addCarrier(player1, 10, 2);
    const warship = addWarship(player2, 13, 13);
    const fullHealth = warship.health();
    const damage = game.config().aircraftDamage();

    tickUntil(() => warship.health() < fullHealth);
    expect(warship.health()).toBe(fullHealth - damage);

    // Each of the 3 aircraft strikes once; none flies again before rearming.
    executeTicks(game, game.config().aircraftRearmTicks() / 2);
    expect(player1.units(UnitType.Aircraft)).toHaveLength(0);
    expect(warship.health()).toBe(
      fullHealth - game.config().carrierMaxAircraft() * damage,
    );
  });

  it("publishes airborne and reloading aircraft on the carrier", () => {
    const carrier = addCarrier(player1, 10, 2);
    const warship = addWarship(player2, 13, 13);
    expect(carrier.missileTimerQueue()).toEqual([]);

    tickUntil(() => player1.units(UnitType.Aircraft).length > 0);
    expect(carrier.missileTimerQueue()).toContain(0);

    tickUntil(() => player1.units(UnitType.Aircraft).length === 0);
    // The carrier ticks before its aircraft, so it sees the last landing next tick.
    game.executeNextTick();
    const queue = carrier.missileTimerQueue();
    expect(queue).toHaveLength(game.config().carrierMaxAircraft());
    expect(queue.every((t) => t > game.ticks())).toBe(true);

    warship.delete(false);
    executeTicks(game, game.config().aircraftRearmTicks());
    expect(carrier.missileTimerQueue()).toEqual([]);
  });

  it("knocks one level off an enemy structure", () => {
    const cityTile = game.ref(3, 3);
    player2.conquer(cityTile);
    const city = player2.buildUnit(UnitType.City, cityTile, {});
    city.increaseLevel();
    expect(city.level()).toBe(2);
    addCarrier(player1, 10, 3);

    tickUntil(() => city.level() < 2);
    expect(city.isActive()).toBe(true);
    expect(city.level()).toBe(1);
  });

  it("ignores its owner's units", () => {
    addCarrier(player1, 10, 2);
    const warship = addWarship(player1, 13, 13);

    executeTicks(game, 50);

    expect(player1.units(UnitType.Aircraft)).toHaveLength(0);
    expect(warship.health()).toBe(warship.maxHealth());
  });

  it("is shot down by an enemy SAM", () => {
    const samTile = game.ref(2, 14);
    player2.conquer(samTile);
    const sam = player2.buildUnit(UnitType.SAMLauncher, samTile, {});
    game.addExecution(new SAMLauncherExecution(player2, null, sam));
    addCarrier(player1, 10, 0);
    const warship = addWarship(player2, 15, 15);
    const fullHealth = warship.health();

    tickUntil(() => player1.units(UnitType.Aircraft).length > 0);
    tickUntil(() => player1.units(UnitType.Aircraft).length === 0);

    expect(warship.health()).toBe(fullHealth);
  });

  it("survives a snapshot round trip mid-sortie", async () => {
    addCarrier(player1, 10, 2);
    addWarship(player2, 13, 13);
    tickUntil(() => player1.units(UnitType.Aircraft).length > 0);

    await expectSnapshotRoundTrip(game, MAP, 30);
  });

  it("patrols slowly, moving at most every other tick", () => {
    const carrier = addCarrier(player1, 12, 8);
    let moves = 0;
    for (let i = 0; i < 40; i++) {
      const before = carrier.tile();
      game.executeNextTick();
      if (carrier.tile() !== before) moves++;
    }
    expect(moves).toBeGreaterThan(0);
    expect(moves).toBeLessThanOrEqual(20);
  });

  it("backs away from a nearby enemy warship", () => {
    const carrier = addCarrier(player1, 12, 8);
    const warship = addWarship(player2, 15, 8);
    const startDist = game.manhattanDist(carrier.tile(), warship.tile());

    executeTicks(game, 10);

    expect(game.manhattanDist(carrier.tile(), warship.tile())).toBeGreaterThan(
      startDist,
    );
  });
});
