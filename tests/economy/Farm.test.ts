import {
  PlayerInfo,
  PlayerType,
  TerrainType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";

let game: Game;
let player: Player;

describe("Farm", () => {
  beforeEach(async () => {
    game = await setup("plains", { infiniteGold: true, instantBuild: true }, [
      new PlayerInfo("farmer", PlayerType.Human, null, "farmer_id"),
    ]);
    player = game.player("farmer_id");
    player.conquer(game.ref(10, 10));
  });

  it("boosts troop growth by its terrain bonus per level", () => {
    const tile = game.ref(10, 10);
    expect(game.terrainType(tile)).toBe(TerrainType.Plains);
    const base = game.config().troopIncreaseRate(player, game);

    const farm = player.buildUnit(UnitType.Farm, tile, {});
    farm.increaseLevel();

    const boosted = game.config().troopIncreaseRate(player, game);
    expect(boosted / base).toBeCloseTo(1.2, 5);
  });

  it("gives more on plains than on highland or mountains", () => {
    const config = game.config();
    expect(config.farmGrowthBonusPercent(TerrainType.Plains)).toBeGreaterThan(
      config.farmGrowthBonusPercent(TerrainType.Highland),
    );
    expect(config.farmGrowthBonusPercent(TerrainType.Highland)).toBeGreaterThan(
      config.farmGrowthBonusPercent(TerrainType.Mountain),
    );
  });

  it("caps the total bonus and ignores farms under construction", () => {
    const farm = player.buildUnit(UnitType.Farm, game.ref(10, 10), {});
    for (let i = 0; i < 20; i++) farm.increaseLevel();
    expect(game.config().farmGrowthBonus(player, game)).toBe(
      game.config().farmMaxGrowthBonusPercent(),
    );

    farm.setUnderConstruction(true);
    expect(game.config().farmGrowthBonus(player, game)).toBe(0);
  });
});
