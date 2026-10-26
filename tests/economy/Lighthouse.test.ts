import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@closefront/engine-api/game/GameTypes";
import { withLighthouseBonus } from "@closefront/engine/execution/utils/Lighthouse";
import { Game, Player } from "@closefront/engine/game/Game";
import { setup } from "../util/Setup";

const coastX = 7;
let game: Game;
let keeper: Player;
let rival: Player;

describe("Lighthouse", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("keeper", PlayerType.Human, null, "keeper_id"),
        new PlayerInfo("rival", PlayerType.Human, null, "rival_id"),
      ],
    );
    keeper = game.player("keeper_id");
    rival = game.player("rival_id");
  });

  it("adds its bonus to trade gold of its owner's ports in range", () => {
    const port = keeper.buildUnit(UnitType.Port, game.ref(coastX, 4), {});
    keeper.buildUnit(UnitType.Lighthouse, game.ref(coastX - 2, 6), {});

    expect(withLighthouseBonus(game, port, 1000n)).toBe(1250n);
  });

  it("does nothing out of range or for someone else's port", () => {
    game.config().lighthouseRange = () => 3;
    const farPort = keeper.buildUnit(UnitType.Port, game.ref(coastX, 1), {});
    const rivalPort = rival.buildUnit(UnitType.Port, game.ref(coastX, 12), {});
    keeper.buildUnit(UnitType.Lighthouse, game.ref(coastX - 1, 12), {});

    expect(withLighthouseBonus(game, farPort, 1000n)).toBe(1000n);
    expect(withLighthouseBonus(game, rivalPort, 1000n)).toBe(1000n);
  });
});
