import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zPlayerRef,
  zRandom,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
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
import { MineExecution } from "./MineExecution";

const WANDER_RADIUS = 6;

export class SubmarineExecution implements Execution {
  private random: PseudoRandom;
  private sub: Unit;
  private mg: Game;
  private pathfinder: WaterPathFinder;
  private lastMineTick = 0;
  private minesLaid: Unit[] = [];

  constructor(
    private input: (UnitParams<UnitType.Submarine> & OwnerComp) | Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathfinder = new WaterPathFinder(mg);
    this.random = new PseudoRandom(mg.ticks());
    this.lastMineTick = mg.ticks();
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
    this.minesLaid = this.minesLaid.filter((m) => m.isActive());

    const config = this.mg.config();
    if (
      this.mg.ticks() - this.lastMineTick >= config.submarineMineInterval() &&
      this.minesLaid.length < config.submarineMaxMines()
    ) {
      this.layMine();
    }

    const patrolTile = this.sub.warshipState().patrolTile;
    let target = this.sub.targetTile();
    if (target === undefined && this.sub.tile() !== patrolTile) {
      target = patrolTile;
      this.sub.setTargetTile(target);
    }
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

  private layMine(): void {
    const tile = this.sub.tile();
    this.lastMineTick = this.mg.ticks();
    if (
      !this.mg.isWater(tile) ||
      this.mg.hasUnitNearby(tile, 2, UnitType.Mine)
    ) {
      this.sub.setTargetTile(this.wanderTile());
      return;
    }
    const mine = this.sub.owner().buildUnit(UnitType.Mine, tile, {});
    this.minesLaid.push(mine);
    this.mg.addExecution(new MineExecution(mine));
    this.sub.setTargetTile(this.wanderTile());
  }

  private wanderTile(): TileRef | undefined {
    const patrolTile = this.sub.warshipState().patrolTile;
    if (patrolTile === undefined || !this.mg.isValidRef(patrolTile)) {
      return undefined;
    }
    const component = this.mg.getWaterComponent(this.sub.tile());
    for (let i = 0; i < 20; i++) {
      const x =
        this.mg.x(patrolTile) +
        this.random.nextInt(-WANDER_RADIUS, WANDER_RADIUS + 1);
      const y =
        this.mg.y(patrolTile) +
        this.random.nextInt(-WANDER_RADIUS, WANDER_RADIUS + 1);
      if (!this.mg.isValidCoord(x, y)) continue;
      const t = this.mg.ref(x, y);
      if (!this.mg.isWater(t)) continue;
      if (component !== null && !this.mg.hasWaterComponent(t, component)) {
        continue;
      }
      return t;
    }
    return undefined;
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
      lastMineTick: this.lastMineTick,
      minesLaid: this.minesLaid.map((m) => w.unit(m)),
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
    this.lastMineTick = s.lastMineTick;
    this.minesLaid = s.minesLaid.map((i) => r.unit(i));
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
  lastMineTick: zInt(),
  minesLaid: z.array(zRef()),
});
type SubmarineState = z.infer<typeof SubmarineStateSchema>;

export const SubmarineExecutionSnapshot = execSnapshotType({
  name: "Submarine",
  version: 1,
  schema: SubmarineStateSchema,
  cls: () => SubmarineExecution,
});
