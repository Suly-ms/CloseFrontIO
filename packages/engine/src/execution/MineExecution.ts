import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

const MINE_TARGETS = [
  UnitType.Warship,
  UnitType.Submarine,
  UnitType.TransportShip,
  UnitType.TradeShip,
] as const;

export class MineExecution implements Execution {
  private mg: Game;
  private active = true;

  constructor(private mine: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (!this.mine.isActive()) {
      this.active = false;
      return;
    }
    const owner = this.mine.owner();
    const victim = this.mg
      .nearbyUnits(
        this.mine.tile(),
        this.mg.config().mineTriggerRange(),
        MINE_TARGETS,
        (e) => {
          const o = e.unit.owner();
          return o !== owner && !owner.isFriendly(o as Player);
        },
      )
      .sort((a, b) => a.distSquared - b.distSquared)[0]?.unit;
    if (victim === undefined) return;

    if (victim.hasHealth()) {
      victim.modifyHealth(-this.mg.config().mineDamage(), owner);
    } else {
      victim.delete(true, owner);
    }
    this.mine.delete(false);
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return MineExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      mine: w.unit(this.mine),
    });
  }

  restoreSnapshot(s: MineState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.mine = r.unit(s.mine);
  }
}

const MineStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  mine: zRef(),
});
type MineState = z.infer<typeof MineStateSchema>;

export const MineExecutionSnapshot = execSnapshotType({
  name: "Mine",
  version: 1,
  schema: MineStateSchema,
  cls: () => MineExecution,
});
