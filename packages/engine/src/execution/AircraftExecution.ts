import { TileRef } from "@openfront/engine-api/game/GameMap";
import { zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Unit } from "../game/Game";
import { PathFinding } from "../pathfinding/PathFinder";
import { PathStatus, SteppingPathFinder } from "../pathfinding/types";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import {
  AirPathFinderSchema,
  airPathFinderState,
  restoreAirPathFinder,
} from "../snapshot/PathfinderSnapshots";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/**
 * One sortie: fly to the target, strike once, fly back and land on the carrier.
 * A landed aircraft is marked reachedTarget so the carrier rearms it instead of
 * rebuilding it.
 */
export class AircraftExecution implements Execution {
  private active = true;
  private returning = false;
  private pathFinder: SteppingPathFinder<TileRef>;
  private mg: Game;

  constructor(
    private carrier: Unit,
    private aircraft: Unit,
    private target: Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathFinder = PathFinding.Air(mg);
  }

  tick(ticks: number): void {
    if (!this.aircraft.isActive()) {
      this.active = false;
      return;
    }
    if (!this.carrier.isActive()) {
      this.aircraft.delete(false);
      this.active = false;
      return;
    }
    const owner = this.aircraft.owner();
    if (
      !this.returning &&
      (!this.target.isActive() ||
        this.target.owner() === owner ||
        !owner.canAttackPlayer(this.target.owner(), true))
    ) {
      this.returnToCarrier();
    }

    for (let i = 0; i < this.mg.config().aircraftSpeed(); i++) {
      const dst = this.returning ? this.carrier.tile() : this.target.tile();
      const result = this.pathFinder.next(this.aircraft.tile(), dst);
      if (result.status === PathStatus.NEXT) {
        this.aircraft.move(result.node);
        continue;
      }
      if (result.status !== PathStatus.COMPLETE) return;
      this.aircraft.move(result.node);
      if (this.returning) {
        this.aircraft.setReachedTarget();
        this.aircraft.delete(false);
        this.active = false;
        return;
      }
      this.strike();
      this.returnToCarrier();
    }
  }

  private strike(): void {
    const owner = this.aircraft.owner();
    if (this.target.hasHealth()) {
      this.target.modifyHealth(-this.mg.config().aircraftDamage(), owner);
    } else {
      // Structures have no health: a strike knocks off one level.
      this.target.decreaseLevel(owner);
    }
  }

  private returnToCarrier(): void {
    this.returning = true;
    this.aircraft.setTargetUnit(undefined);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return AircraftExecutionSnapshot.write({
      active: this.active,
      returning: this.returning,
      pathFinder:
        this.mg === undefined ? null : airPathFinderState(this.pathFinder),
      carrier: w.unit(this.carrier),
      aircraft: w.unit(this.aircraft),
      target: w.unit(this.target),
    });
  }

  restoreSnapshot(s: AircraftState, r: SnapshotReader): void {
    this.active = s.active;
    this.returning = s.returning;
    if (s.pathFinder !== null) {
      this.mg = r.game;
      this.pathFinder = restoreAirPathFinder(r.game, s.pathFinder);
    }
    this.carrier = r.unit(s.carrier);
    this.aircraft = r.unit(s.aircraft);
    this.target = r.unit(s.target);
  }
}

const AircraftStateSchema = z.object({
  active: z.boolean(),
  returning: z.boolean(),
  pathFinder: AirPathFinderSchema.nullable(),
  carrier: zRef(),
  aircraft: zRef(),
  target: zRef(),
});
type AircraftState = z.infer<typeof AircraftStateSchema>;

export const AircraftExecutionSnapshot = execSnapshotType({
  name: "Aircraft",
  version: 1,
  schema: AircraftStateSchema,
  cls: () => AircraftExecution,
});
