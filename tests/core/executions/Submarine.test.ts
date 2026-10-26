import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@closefront/engine-api/game/GameTypes";
import { SubmarineExecution } from "@closefront/engine/execution/SubmarineExecution";
import { WarshipExecution } from "@closefront/engine/execution/WarshipExecution";
import { Game, Player, Unit } from "@closefront/engine/game/Game";
import { setup } from "../../util/Setup";
import { expectSnapshotRoundTrip } from "../../util/Snapshot";
import { executeTicks } from "../../util/utils";

const MAP = "half_land_half_ocean";
const coastX = 7;
let game: Game;
let player1: Player;
let player2: Player;

function addSubmarine(x: number, y: number): Unit {
  const tile = game.ref(x, y);
  const sub = player1.buildUnit(UnitType.Submarine, tile, {
    patrolTile: tile,
  });
  game.addExecution(new SubmarineExecution(sub));
  return sub;
}

function addTradeShip(owner: Player, x: number, y: number): Unit {
  return owner.buildUnit(UnitType.TradeShip, game.ref(x, y), {
    targetUnit: owner.buildUnit(UnitType.Port, game.ref(coastX, 10), {}),
  });
}

describe("submarine", () => {
  beforeEach(async () => {
    game = await setup(MAP, { infiniteGold: true, instantBuild: true }, [
      new PlayerInfo("submarine owner", PlayerType.Human, null, "player_1_id"),
      new PlayerInfo("naval enemy", PlayerType.Human, null, "player_2_id"),
    ]);
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
  });

  it("torpedoes an enemy trade ship in range", () => {
    addSubmarine(12, 8);
    const tradeShip = addTradeShip(player2, 12, 12);

    executeTicks(game, 5);

    expect(tradeShip.isActive()).toBe(false);
    expect(player1.units(UnitType.TradeShip)).toHaveLength(0);
  });

  it("torpedoes an enemy transport ship in range", () => {
    addSubmarine(12, 8);
    const transport = player2.buildUnit(
      UnitType.TransportShip,
      game.ref(12, 12),
      { troops: 10 },
    );

    executeTicks(game, 5);

    expect(transport.isActive()).toBe(false);
  });

  it("fires once per reload", () => {
    addSubmarine(12, 8);
    const ships = [
      addTradeShip(player2, 12, 12),
      addTradeShip(player2, 13, 12),
    ];

    executeTicks(game, 5);
    expect(ships.filter((s) => s.isActive())).toHaveLength(1);

    executeTicks(game, game.config().submarineTorpedoReload());
    expect(ships.filter((s) => s.isActive())).toHaveLength(0);
  });

  it("leaves allied trade ships alone", () => {
    player1.createAllianceRequest(player2)?.accept();
    addSubmarine(12, 8);
    const tradeShip = addTradeShip(player2, 12, 12);

    executeTicks(game, 5);

    expect(tradeShip.isActive()).toBe(true);
  });

  it("is hunted down by enemy warships", () => {
    const sub = addSubmarine(12, 8);
    const warshipTile = game.ref(15, 8);
    const warship = player2.buildUnit(UnitType.Warship, warshipTile, {
      patrolTile: warshipTile,
    });
    game.addExecution(new WarshipExecution(warship));

    for (let i = 0; i < 200 && sub.isActive(); i++) game.executeNextTick();

    expect(sub.isActive()).toBe(false);
  });

  it("keeps patrolling after reaching its patrol tile", () => {
    const sub = addSubmarine(12, 8);
    const visited = new Set<number>();
    for (let i = 0; i < 40; i++) {
      game.executeNextTick();
      visited.add(sub.tile());
    }
    expect(visited.size).toBeGreaterThan(1);
  });

  it("slips away from a nearby enemy warship", () => {
    const sub = addSubmarine(12, 8);
    const warshipTile = game.ref(15, 8);
    player2.buildUnit(UnitType.Warship, warshipTile, {
      patrolTile: warshipTile,
    });
    const startDist = game.manhattanDist(sub.tile(), warshipTile);

    executeTicks(game, 10);

    expect(game.manhattanDist(sub.tile(), warshipTile)).toBeGreaterThan(
      startDist,
    );
  });

  it("survives a snapshot round trip with a torpedo in flight", async () => {
    addSubmarine(12, 8);
    addTradeShip(player2, 12, 15);
    game.executeNextTick();

    await expectSnapshotRoundTrip(game, MAP, 30);
  });
});
