import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { MineExecution } from "@openfront/engine/execution/MineExecution";
import { SubmarineExecution } from "@openfront/engine/execution/SubmarineExecution";
import { WarshipExecution } from "@openfront/engine/execution/WarshipExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../../util/Setup";
import { executeTicks } from "../../util/utils";

const coastX = 7;
let game: Game;
let player1: Player;
let player2: Player;

describe("submarine mines", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo(
          "submarine owner",
          PlayerType.Human,
          null,
          "player_1_id",
        ),
        new PlayerInfo("naval enemy", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
  });

  it("lays mines on water after its mine interval", () => {
    const waterTile = game.ref(coastX + 1, 10);
    player1.buildUnit(UnitType.NavalBeacon, waterTile, {});
    const submarine = player1.buildUnit(UnitType.Submarine, waterTile, {
      patrolTile: waterTile,
    });
    game.addExecution(new SubmarineExecution(submarine));

    executeTicks(game, game.config().submarineMineInterval() + 1);

    const mines = player1.units(UnitType.Mine);
    expect(mines).toHaveLength(1);
    expect(game.isWater(mines[0].tile())).toBe(true);
  });

  it.each([UnitType.Warship, UnitType.Submarine])(
    "detonates within range of an enemy %s",
    (type) => {
      const mineTile = game.ref(coastX + 1, 10);
      player1.buildUnit(UnitType.NavalBeacon, mineTile, {});
      const mine = player1.buildUnit(UnitType.Mine, mineTile, {});
      game.addExecution(new MineExecution(mine));
      const targetTile = game.ref(coastX + 5, 10);
      const target =
        type === UnitType.Warship
          ? player2.buildUnit(UnitType.Warship, targetTile, {
              patrolTile: targetTile,
            })
          : player2.buildUnit(UnitType.Submarine, targetTile, {
              patrolTile: targetTile,
            });
      const initialHealth = target.health();

      game.executeNextTick();
      expect(target.health()).toBe(initialHealth);
      expect(mine.isActive()).toBe(true);

      target.move(game.ref(coastX + 4, 10));
      game.executeNextTick();

      expect(target.health()).toBe(initialHealth - game.config().mineDamage());
      expect(mine.isActive()).toBe(false);
    },
  );

  it("destroys an enemy transport boat within range", () => {
    const mineTile = game.ref(coastX + 1, 10);
    player1.buildUnit(UnitType.NavalBeacon, mineTile, {});
    const mine = player1.buildUnit(UnitType.Mine, mineTile, {});
    game.addExecution(new MineExecution(mine));
    const targetTile = game.ref(coastX + 5, 10);
    const target = player2.buildUnit(UnitType.TransportShip, targetTile, {
      troops: 10,
    });

    game.executeNextTick();
    expect(target.isActive()).toBe(true);
    expect(mine.isActive()).toBe(true);

    target.move(game.ref(coastX + 4, 10));
    game.executeNextTick();

    expect(target.isActive()).toBe(false);
    expect(mine.isActive()).toBe(false);
  });

  it("covers a 30-tile maritime radius", async () => {
    const largeGame = await setup(
      "big_plains",
      { infiniteGold: true, instantBuild: true },
      [new PlayerInfo("beacon owner", PlayerType.Human, null, "beacon_owner")],
    );
    const owner = largeGame.player("beacon_owner");
    const center = largeGame.ref(100, 100);
    owner.buildUnit(UnitType.NavalBeacon, center, {});

    expect(owner.isInMaritimeZone(largeGame.ref(130, 100))).toBe(true);
    expect(owner.isInMaritimeZone(largeGame.ref(131, 100))).toBe(false);
  });

  it("keeps a placed naval beacon active after construction", () => {
    const waterTile = game.ref(coastX + 1, 10);
    player1.conquer(game.ref(coastX, 10));
    expect(game.isWater(waterTile)).toBe(true);
    game.addExecution(
      new ConstructionExecution(player1, UnitType.NavalBeacon, waterTile),
    );

    executeTicks(game, 3);

    const [beacon] = player1.units(UnitType.NavalBeacon);
    expect(beacon).toBeDefined();
    expect(beacon.isActive()).toBe(true);
    expect(beacon.isUnderConstruction()).toBe(false);
  });

  it("survives the normal naval beacon construction timer", async () => {
    const constructionGame = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: false },
      [new PlayerInfo("beacon owner", PlayerType.Human, null, "beacon_owner")],
    );
    const owner = constructionGame.player("beacon_owner");
    const waterTile = constructionGame.ref(coastX + 1, 10);
    owner.conquer(constructionGame.ref(coastX, 10));
    constructionGame.addExecution(
      new ConstructionExecution(owner, UnitType.NavalBeacon, waterTile),
    );

    const duration = constructionGame
      .config()
      .unitInfo(UnitType.NavalBeacon).constructionDuration!;
    executeTicks(constructionGame, duration + 3);

    const [beacon] = owner.units(UnitType.NavalBeacon);
    expect(beacon).toBeDefined();
    expect(beacon.isActive()).toBe(true);
    expect(beacon.isUnderConstruction()).toBe(false);
  });

  it("acquires naval targets only inside friendly maritime zones", () => {
    const shipTile = game.ref(coastX + 1, 10);
    const targetTile = game.ref(coastX + 2, 10);
    const ship = player1.buildUnit(UnitType.Warship, shipTile, {
      patrolTile: shipTile,
    });
    const target = player2.buildUnit(UnitType.Warship, targetTile, {
      patrolTile: targetTile,
    });
    game.addExecution(new WarshipExecution(ship));

    game.executeNextTick();
    expect(ship.targetUnit()).toBeUndefined();

    player1.buildUnit(UnitType.NavalBeacon, shipTile, {});
    game.executeNextTick();

    expect(ship.targetUnit()).toBe(target);
  });
});
