import { UnitType } from "@closefront/engine-api/game/GameTypes";
import { PseudoRandom } from "@closefront/engine-lib/PseudoRandom";
import {
  zInt,
  zPlayerRef,
  zRandom,
  zRef,
  zTile,
} from "@closefront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import {
  Execution,
  Game,
  isUnit,
  OwnerComp,
  Unit,
  UnitParams,
} from "../game/Game";
import { WaterPathFinder } from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import {
  restoreWaterPathFinder,
  WaterPathFinderSchema,
  waterPathFinderState,
} from "../snapshot/PathfinderSnapshots";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { ShellExecution } from "./ShellExecution";
import { patrolTarget } from "./utils/NavalMovement";

const WANDER_RADIUS = 15;
// Subs slip away from enemy warships rather than trading shots with them.
const EVADE_RANGE = 40;
const EVADE_DISTANCE = 20;

const TORPEDO_TARGETS = [UnitType.TradeShip, UnitType.TransportShip] as const;

export class SubmarineExecution implements Execution {
  private random: PseudoRandom;
  private sub: Unit;
  private mg: Game;
  private pathfinder: WaterPathFinder;
  private lastTorpedoTick = 0;

  constructor(
    private input: (UnitParams<UnitType.Submarine> & OwnerComp) | Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathfinder = new WaterPathFinder(mg);
    this.random = new PseudoRandom(mg.ticks());
    // Ready to fire as soon as it launches.
    this.lastTorpedoTick = mg.ticks() - mg.config().submarineTorpedoReload();
    if (isUnit(this.input)) {
      this.sub = this.input;
      return;
    }
    const spawn = this.input.owner.canBuild(
      UnitType.Submarine,
      this.input.patrolTile,
    );
    if (spawn === false) {
      console.warn(
        `Failed to spawn submarine for ${this.input.owner.name()} at ${this.input.patrolTile}`,
      );
      return;
    }
    this.sub = this.input.owner.buildUnit(
      UnitType.Submarine,
      spawn,
      this.input,
    );
  }

  tick(ticks: number): void {
    if (this.sub.health() <= 0) {
      this.sub.delete();
      return;
    }
    if (
      this.mg.ticks() - this.lastTorpedoTick >=
      this.mg.config().submarineTorpedoReload()
    ) {
      this.fireTorpedo();
    }

    const target = patrolTarget(
      this.mg,
      this.random,
      this.sub,
      WANDER_RADIUS,
      EVADE_RANGE,
      EVADE_DISTANCE,
    );
    this.sub.setTargetTile(target);
    if (target === undefined) return;

    const result = this.pathfinder.next(this.sub.tile(), target);
    switch (result.status) {
      case PathStatus.COMPLETE:
        this.sub.setTargetTile(undefined);
        this.sub.move(result.node);
        break;
      case PathStatus.NEXT:
        this.sub.move(result.node);
        break;
      case PathStatus.NOT_FOUND:
        this.sub.setTargetTile(undefined);
        break;
    }
  }

  /** Torpedoes the closest enemy trade ship or transport in range. */
  private fireTorpedo(): void {
    const owner = this.sub.owner();
    const target = this.mg
      .nearbyUnits(
        this.sub.tile(),
        this.mg.config().submarineTorpedoRange(),
        TORPEDO_TARGETS,
      )
      .filter(
        ({ unit }) =>
          unit.owner() !== owner && owner.canAttackPlayer(unit.owner(), true),
      )
      .sort((a, b) => a.distSquared - b.distSquared)[0]?.unit;
    if (target === undefined) return;
    this.lastTorpedoTick = this.mg.ticks();
    this.mg.addExecution(
      new ShellExecution(this.sub.tile(), owner, this.sub, target),
    );
  }

  isActive(): boolean {
    return this.sub?.isActive();
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return SubmarineExecutionSnapshot.write({
      input: isUnit(this.input)
        ? { unit: w.unit(this.input) }
        : {
            owner: w.player(this.input.owner),
            patrolTile: this.input.patrolTile,
          },
      initialized: this.mg !== undefined,
      random: this.random === undefined ? null : w.random(this.random),
      sub: this.sub === undefined ? null : w.unit(this.sub),
      pathfinder:
        this.pathfinder === undefined
          ? null
          : waterPathFinderState(this.pathfinder),
      lastTorpedoTick: this.lastTorpedoTick,
    });
  }

  restoreSnapshot(s: SubmarineState, r: SnapshotReader): void {
    this.input =
      "unit" in s.input
        ? r.unit(s.input.unit)
        : { owner: r.player(s.input.owner), patrolTile: s.input.patrolTile };
    if (s.initialized) this.mg = r.game;
    if (s.random !== null) this.random = r.random(s.random);
    if (s.sub !== null) this.sub = r.unit(s.sub);
    if (s.pathfinder !== null) {
      this.pathfinder = restoreWaterPathFinder(r.game, s.pathfinder);
    }
    this.lastTorpedoTick = s.lastTorpedoTick;
  }
}

const SubmarineStateSchema = z.object({
  input: z.union([
    z.object({ unit: zRef() }),
    z.object({ owner: zPlayerRef(), patrolTile: zTile() }),
  ]),
  initialized: z.boolean(),
  random: zRandom().nullable(),
  sub: zRef().nullable(),
  pathfinder: WaterPathFinderSchema.nullable(),
  lastTorpedoTick: zInt(),
});
type SubmarineState = z.infer<typeof SubmarineStateSchema>;

export const SubmarineExecutionSnapshot = execSnapshotType({
  name: "Submarine",
  version: 1,
  schema: SubmarineStateSchema,
  cls: () => SubmarineExecution,
});
