import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { Game, Unit } from "../../game/Game";

/** Whether a finished lighthouse of the port's owner stands within range. */
export function isLighthouseBoosted(mg: Game, port: Unit): boolean {
  return mg.hasUnitNearby(
    port.tile(),
    mg.config().lighthouseRange(),
    UnitType.Lighthouse,
    port.owner().id(),
  );
}

/** `gold` plus the lighthouse bonus when the port is boosted. */
export function withLighthouseBonus(
  mg: Game,
  port: Unit,
  gold: bigint,
): bigint {
  if (!isLighthouseBoosted(mg, port)) return gold;
  return (
    (gold * BigInt(100 + mg.config().lighthouseTradeBonusPercent())) / 100n
  );
}
