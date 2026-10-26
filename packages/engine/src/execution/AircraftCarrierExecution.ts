import { Structures, UnitType } from "@closefront/engine-api/game/GameTypes";
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
import { AircraftExecution } from "./AircraftExecution";
import { patrolTarget } from "./utils/NavalMovement";

const SCAN_INTERVAL = 10;
// Carriers are slow and keep their distance; their aircraft do the fighting.
const MOVE_INTERVAL = 2;
const PATROL_RADIUS = 30;
const STANDOFF_RANGE = 40;
const STANDOFF_DISTANCE = 20;

const SHIP_TARGETS = [
  UnitType.Warship,
  UnitType.Submarine,
  UnitType.TransportShip,
  UnitType.AircraftCarrier,
] as const;

/** One hangar slot: the aircraft in flight, or the tick the slot is ready again. */
type Slot = { aircraft: Unit | null; readyAt: number };

export class AircraftCarrierExecution implements Execution {
  private carrier: Unit;
  private mg: Game;
  private pathfinder: WaterPathFinder;
  private random: PseudoRandom;
  private slots: Slot[] = [];

  constructor(
    private input: (UnitParams<UnitType.AircraftCarrier> & OwnerComp) | Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathfinder = new WaterPathFinder(mg);
    this.random = new PseudoRandom(mg.ticks());
    this.slots = Array.from(
      { length: mg.config().carrierMaxAircraft() },
      () => ({ aircraft: null, readyAt: mg.ticks() }),
    );
    if (isUnit(this.input)) {
      this.carrier = this.input;
      return;
    }
    const spawn = this.input.owner.canBuild(
      UnitType.AircraftCarrier,
      this.input.patrolTile,
    );
    if (spawn === false) {
      console.warn(
        `Failed to spawn aircraft carrier for ${this.input.owner.name()} at ${this.input.patrolTile}`,
      );
      return;
    }
    this.carrier = this.input.owner.buildUnit(
      UnitType.AircraftCarrier,
      spawn,
      this.input,
    );
  }

  tick(ticks: number): void {
    if (this.carrier.health() <= 0) {
      this.carrier.delete();
      return;
    }

    const config = this.mg.config();
    for (const slot of this.slots) {
      if (slot.aircraft === null || slot.aircraft.isActive()) continue;
      // Landed aircraft rearm; shot-down ones are rebuilt.
      slot.readyAt =
        this.mg.ticks() +
        (slot.aircraft.reachedTarget()
          ? config.aircraftRearmTicks()
          : config.aircraftRebuildTicks());
      slot.aircraft = null;
    }

    if (this.mg.ticks() % SCAN_INTERVAL === 0) {
      this.launch();
    }
    this.carrier.setHangar(
      this.slots
        .filter((s) => s.aircraft !== null || s.readyAt > this.mg.ticks())
        .map((s) => (s.aircraft !== null ? 0 : s.readyAt)),
    );

    if (this.mg.ticks() % MOVE_INTERVAL !== 0) return;
    const target = patrolTarget(
      this.mg,
      this.random,
      this.carrier,
      PATROL_RADIUS,
      STANDOFF_RANGE,
      STANDOFF_DISTANCE,
    );
    this.carrier.setTargetTile(target);
    if (target === undefined) return;

    const result = this.pathfinder.next(this.carrier.tile(), target);
    switch (result.status) {
      case PathStatus.COMPLETE:
        this.carrier.setTargetTile(undefined);
        this.carrier.move(result.node);
        break;
      case PathStatus.NEXT:
        this.carrier.move(result.node);
        break;
      case PathStatus.NOT_FOUND:
        this.carrier.setTargetTile(undefined);
        break;
    }
  }

  private launch(): void {
    const slot = this.slots.find(
      (s) => s.aircraft === null && s.readyAt <= this.mg.ticks(),
    );
    if (slot === undefined) return;
    const target = this.findTarget();
    if (target === undefined) return;

    const aircraft = this.carrier
      .owner()
      .buildUnit(UnitType.Aircraft, this.carrier.tile(), {});
    aircraft.setTargetUnit(target);
    slot.aircraft = aircraft;
    this.mg.addExecution(new AircraftExecution(this.carrier, aircraft, target));
  }

  /** Closest enemy ship in range, else closest enemy structure. */
  private findTarget(): Unit | undefined {
    const owner = this.carrier.owner();
    const targeted = new Set(
      this.slots.map((s) => s.aircraft?.targetUnit()).filter((u) => u),
    );
    const closest = (types: readonly UnitType[]) =>
      this.mg
        .nearbyUnits(
          this.carrier.tile(),
          this.mg.config().aircraftRange(),
          types,
        )
        .filter(
          ({ unit }) =>
            unit.owner() !== owner &&
            owner.canAttackPlayer(unit.owner(), true) &&
            !targeted.has(unit),
        )
        .sort((a, b) => a.distSquared - b.distSquared)[0]?.unit;
    return closest(SHIP_TARGETS) ?? closest(Structures.types);
  }

  isActive(): boolean {
    return this.carrier?.isActive();
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return AircraftCarrierExecutionSnapshot.write({
      input: isUnit(this.input)
        ? { unit: w.unit(this.input) }
        : {
            owner: w.player(this.input.owner),
            patrolTile: this.input.patrolTile,
          },
      initialized: this.mg !== undefined,
      carrier: this.carrier === undefined ? null : w.unit(this.carrier),
      random: this.random === undefined ? null : w.random(this.random),
      pathfinder:
        this.pathfinder === undefined
          ? null
          : waterPathFinderState(this.pathfinder),
      slots: this.slots.map((s) => ({
        aircraft: w.unitOrNull(s.aircraft),
        readyAt: s.readyAt,
      })),
    });
  }

  restoreSnapshot(s: AircraftCarrierState, r: SnapshotReader): void {
    this.input =
      "unit" in s.input
        ? r.unit(s.input.unit)
        : { owner: r.player(s.input.owner), patrolTile: s.input.patrolTile };
    if (s.initialized) this.mg = r.game;
    if (s.carrier !== null) this.carrier = r.unit(s.carrier);
    if (s.random !== null) this.random = r.random(s.random);
    if (s.pathfinder !== null) {
      this.pathfinder = restoreWaterPathFinder(r.game, s.pathfinder);
    }
    this.slots = s.slots.map((slot) => ({
      aircraft: r.unitOrNull(slot.aircraft),
      readyAt: slot.readyAt,
    }));
  }
}

const AircraftCarrierStateSchema = z.object({
  input: z.union([
    z.object({ unit: zRef() }),
    z.object({ owner: zPlayerRef(), patrolTile: zTile() }),
  ]),
  initialized: z.boolean(),
  carrier: zRef().nullable(),
  random: zRandom().nullable(),
  pathfinder: WaterPathFinderSchema.nullable(),
  slots: z.array(z.object({ aircraft: zRef().nullable(), readyAt: zInt() })),
});
type AircraftCarrierState = z.infer<typeof AircraftCarrierStateSchema>;

export const AircraftCarrierExecutionSnapshot = execSnapshotType({
  name: "AircraftCarrier",
  version: 1,
  schema: AircraftCarrierStateSchema,
  cls: () => AircraftCarrierExecution,
});
