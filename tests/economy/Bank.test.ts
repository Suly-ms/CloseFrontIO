import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@closefront/engine-api/game/GameTypes";
import { PlayerExecution } from "@closefront/engine/execution/PlayerExecution";
import { Game, Player } from "@closefront/engine/game/Game";
import { setup } from "../util/Setup";
import { executeTicks } from "../util/utils";

const abs = (n: bigint) => (n < 0n ? -n : n);

let game: Game;
let banker: Player;
let saver: Player;

/** Runs one full interest interval, so exactly one payout happens. */
function tickPastPayout(): void {
  executeTicks(game, game.config().bankInterestInterval() + 1);
}

describe("Bank", () => {
  beforeEach(async () => {
    game = await setup("plains", { infiniteGold: false, instantBuild: true }, [
      new PlayerInfo("banker", PlayerType.Human, null, "banker_id"),
      new PlayerInfo("saver", PlayerType.Human, null, "saver_id"),
    ]);
    banker = game.player("banker_id");
    saver = game.player("saver_id");
    // A few tiles so losing the bank tile doesn't eliminate the banker.
    for (let x = 10; x < 14; x++) banker.conquer(game.ref(x, 10));
    saver.conquer(game.ref(80, 80));
    while (game.inSpawnPhase()) game.executeNextTick();
    game.addExecution(new PlayerExecution(banker), new PlayerExecution(saver));
  });

  /** Builds a bank and evens out both balances at `gold`. */
  function buildBank(gold = 1_000_000n) {
    const bank = banker.buildUnit(UnitType.Bank, game.ref(10, 10), {});
    banker.removeGold(banker.gold());
    saver.removeGold(saver.gold());
    banker.addGold(gold);
    saver.addGold(gold);
    return bank;
  }

  it("pays interest on stored gold once per interval, per level", () => {
    const bank = buildBank();
    bank.increaseLevel();

    tickPastPayout();

    // Same income otherwise, so the gap is the interest: 1 % per level.
    const gap = banker.gold() - saver.gold();
    expect(gap).toBeGreaterThanOrEqual(20_000n);
    // Interest is on the balance at payout, which includes a minute of income.
    expect(gap).toBeLessThan(22_000n);
  });

  it("caps interest per level", () => {
    buildBank(100_000_000n);

    tickPastPayout();

    expect(banker.gold() - saver.gold()).toBe(
      game.config().bankInterestCapPerLevel(),
    );
  });

  it("pays nothing while under construction", () => {
    const bank = buildBank();
    bank.setUnderConstruction(true);

    tickPastPayout();

    expect(banker.gold()).toBe(saver.gold());
  });

  it("is looted by whoever captures it", () => {
    buildBank();
    game.executeNextTick();
    const bankerGold = banker.gold();
    const saverGold = saver.gold();

    saver.conquer(game.ref(10, 10));
    game.executeNextTick();

    const looted = bankerGold / 10n;
    expect(banker.units(UnitType.Bank)).toHaveLength(0);
    expect(saver.units(UnitType.Bank)).toHaveLength(1);
    // Within one tick of passive income.
    expect(abs(saver.gold() - saverGold - looted)).toBeLessThanOrEqual(200n);
    expect(abs(bankerGold - banker.gold() - looted)).toBeLessThanOrEqual(200n);
  });
});
