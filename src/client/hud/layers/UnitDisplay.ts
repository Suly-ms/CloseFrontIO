import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { renderNumber } from "@openfront/engine-lib/Format";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { ToggleStructureEvent } from "../../InputHandler";
import { UIState } from "../../UIState";
import { UserSettings } from "../../UserSettings";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import {
  atomBombIcon,
  bankIcon,
  cityIcon,
  defensePostIcon,
  factoryIcon,
  farmIcon,
  goldCoinIcon,
  hydrogenBombIcon,
  lighthouseIcon,
  mirvIcon,
  militaryPortIcon,
  missileSiloIcon,
  portIcon,
  samLauncherIcon,
  aircraftCarrierIcon,
  submarineIcon,
  warshipIcon,
} from "../HotbarIcons";
import { TutorialHighlight, TutorialHighlightEvent } from "../Tutorial";

interface HotbarItem {
  icon: string;
  count: number | null;
  type: PlayerBuildableUnitType;
  key: string;
  hotkey: string;
}

interface HotbarFolder {
  id: string;
  icon: string;
  items: HotbarItem[];
}

@customElement("unit-display")
export class UnitDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private playerBuildables: BuildableUnit[] | null = null;
  private keybinds: Record<string, { value: string; key: string }> = {};
  private _cities = 0;
  private _warships = 0;
  private _factories = 0;
  private _banks = 0;
  private _farms = 0;
  private _lighthouses = 0;
  private _missileSilo = 0;
  private _port = 0;
  private _militaryPorts = 0;
  private _submarines = 0;
  private _carriers = 0;
  private _defensePost = 0;
  private _samLauncher = 0;
  private allDisabled = false;
  private _hoveredUnit: PlayerBuildableUnitType | null = null;
  private tutorialHighlight: PlayerBuildableUnitType | null = null;
  private openFolder: string | null = "economy";
  private lastFocus: UnitType | null = null;

  createRenderRoot() {
    return this;
  }

  init() {
    const config = this.game.config();
    const userSettings = new UserSettings();

    this.keybinds = userSettings.parsedUserKeybinds();

    this.allDisabled = BuildMenus.types.every((u) => config.isUnitDisabled(u));

    const highlightUnits: Partial<
      Record<TutorialHighlight, PlayerBuildableUnitType>
    > = {
      city: UnitType.City,
      port: UnitType.Port,
      defense_post: UnitType.DefensePost,
      factory: UnitType.Factory,
      warship: UnitType.Warship,
      silo: UnitType.MissileSilo,
      atom: UnitType.AtomBomb,
      hydrogen: UnitType.HydrogenBomb,
      mirv: UnitType.MIRV,
      sam: UnitType.SAMLauncher,
    };
    this.eventBus.on(TutorialHighlightEvent, (e) => {
      this.tutorialHighlight = (e.target && highlightUnits[e.target]) ?? null;
      this.requestUpdate();
    });
    this.requestUpdate();
  }

  private cost(item: UnitType): Gold {
    for (const bu of this.playerBuildables ?? []) {
      if (bu.type === item) {
        return bu.cost;
      }
    }
    return 0n;
  }

  private canBuild(item: UnitType): boolean {
    if (this.game?.config().isUnitDisabled(item)) return false;
    const player = this.game?.myPlayer();
    switch (item) {
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
      case UnitType.MIRV:
        return (
          this.cost(item) <= (player?.gold() ?? 0n) &&
          (player?.units(UnitType.MissileSilo).length ?? 0) > 0
        );
      case UnitType.Warship:
      case UnitType.Submarine:
      case UnitType.AircraftCarrier:
        return (
          this.cost(item) <= (player?.gold() ?? 0n) &&
          (player
            ?.units(UnitType.MilitaryPort)
            .some((port) => port.isActive() && !port.isUnderConstruction()) ??
            false)
        );
      default:
        return this.cost(item) <= (player?.gold() ?? 0n);
    }
  }

  tick() {
    const player = this.game?.myPlayer();
    if (!player) return;
    player.buildables(undefined, BuildMenus.types).then((buildables) => {
      this.playerBuildables = buildables;
    });
    this._cities = player.totalUnitLevels(UnitType.City);
    this._missileSilo = player.totalUnitLevels(UnitType.MissileSilo);
    this._port = player.totalUnitLevels(UnitType.Port);
    this._militaryPorts = player.totalUnitLevels(UnitType.MilitaryPort);
    this._submarines = player.totalUnitLevels(UnitType.Submarine);
    this._carriers = player.totalUnitLevels(UnitType.AircraftCarrier);
    this._defensePost = player.totalUnitLevels(UnitType.DefensePost);
    this._samLauncher = player.totalUnitLevels(UnitType.SAMLauncher);
    this._factories = player.totalUnitLevels(UnitType.Factory);
    this._banks = player.totalUnitLevels(UnitType.Bank);
    this._farms = player.totalUnitLevels(UnitType.Farm);
    this._lighthouses = player.totalUnitLevels(UnitType.Lighthouse);
    this._warships = player.totalUnitLevels(UnitType.Warship);
    this.requestUpdate();
  }

  render() {
    const myPlayer = this.game?.myPlayer();
    if (
      !this.game ||
      !myPlayer ||
      this.game.inSpawnPhase() ||
      !myPlayer.isAlive()
    ) {
      return null;
    }
    if (this.allDisabled) {
      return null;
    }

    const item = (
      icon: string,
      count: number | null,
      type: PlayerBuildableUnitType,
      key: string,
      keybind: string,
      fallbackKey: string,
    ): HotbarItem => ({
      icon,
      count,
      type,
      key,
      hotkey: this.keybinds[keybind]?.key ?? fallbackKey,
    });
    const folders: HotbarFolder[] = [
      {
        id: "economy",
        icon: cityIcon,
        items: [
          item(cityIcon, this._cities, UnitType.City, "city", "buildCity", "1"),
          item(
            factoryIcon,
            this._factories,
            UnitType.Factory,
            "factory",
            "buildFactory",
            "2",
          ),
          item(bankIcon, this._banks, UnitType.Bank, "bank", "buildBank", "H"),
          item(farmIcon, this._farms, UnitType.Farm, "farm", "buildFarm", "Z"),
          item(portIcon, this._port, UnitType.Port, "port", "buildPort", "3"),
          item(
            lighthouseIcon,
            this._lighthouses,
            UnitType.Lighthouse,
            "lighthouse",
            "buildLighthouse",
            "I",
          ),
        ],
      },
      {
        id: "defense",
        icon: defensePostIcon,
        items: [
          item(
            defensePostIcon,
            this._defensePost,
            UnitType.DefensePost,
            "defense_post",
            "buildDefensePost",
            "4",
          ),
          item(
            samLauncherIcon,
            this._samLauncher,
            UnitType.SAMLauncher,
            "sam_launcher",
            "buildSamLauncher",
            "6",
          ),
          item(
            missileSiloIcon,
            this._missileSilo,
            UnitType.MissileSilo,
            "missile_silo",
            "buildMissileSilo",
            "5",
          ),
        ],
      },
      {
        id: "naval",
        icon: warshipIcon,
        items: [
          item(
            militaryPortIcon,
            this._militaryPorts,
            UnitType.MilitaryPort,
            "military_port",
            "buildMilitaryPort",
            "V",
          ),
          item(
            warshipIcon,
            this._warships,
            UnitType.Warship,
            "warship",
            "buildWarship",
            "7",
          ),
          item(
            submarineIcon,
            this._submarines,
            UnitType.Submarine,
            "submarine",
            "buildSubmarine",
            "O",
          ),
          item(
            aircraftCarrierIcon,
            this._carriers,
            UnitType.AircraftCarrier,
            "aircraft_carrier",
            "buildAircraftCarrier",
            "J",
          ),
        ],
      },
      {
        id: "nuclear",
        icon: atomBombIcon,
        items: [
          item(
            atomBombIcon,
            null,
            UnitType.AtomBomb,
            "atom_bomb",
            "buildAtomBomb",
            "8",
          ),
          item(
            hydrogenBombIcon,
            null,
            UnitType.HydrogenBomb,
            "hydrogen_bomb",
            "buildHydrogenBomb",
            "9",
          ),
          item(mirvIcon, null, UnitType.MIRV, "mirv", "buildMIRV", "0"),
        ],
      },
    ]
      .map((folder) => ({
        ...folder,
        items: folder.items.filter(
          (i) => !this.game.config().isUnitDisabled(i.type),
        ),
      }))
      .filter((folder) => folder.items.length > 0);

    // A hotkey or tutorial pick opens the folder holding that unit.
    const focus = this.uiState.ghostStructure ?? this.tutorialHighlight;
    const focused = folders.find((f) => f.items.some((i) => i.type === focus));
    if (focused !== undefined && focus !== this.lastFocus) {
      this.openFolder = focused.id;
    }
    this.lastFocus = focus;
    const open = folders.find((f) => f.id === this.openFolder);

    return html`
      <div class="border-t border-white/10 p-0.5 w-full">
        ${open
          ? html`<div
              class="flex flex-wrap justify-center gap-0.5 w-full mb-0.5"
            >
              ${open.items.map((i) =>
                this.renderUnitItem(i.icon, i.count, i.type, i.key, i.hotkey),
              )}
            </div>`
          : null}
        <div class="flex justify-center gap-0.5 w-full">
          ${folders.map((folder) => this.renderFolderTab(folder, open))}
        </div>
      </div>
    `;
  }

  private renderFolderTab(
    folder: HotbarFolder,
    open: HotbarFolder | undefined,
  ) {
    const isOpen = folder === open;
    const highlighted = folder.items.some(
      (i) => i.type === this.tutorialHighlight,
    );
    const total = folder.items.reduce((sum, i) => sum + (i.count ?? 0), 0);
    return html`
      <button
        class="flex items-center gap-1 border rounded-sm px-1.5 py-0.5 text-xs text-white cursor-pointer
          ${isOpen
          ? "border-slate-300 bg-slate-400/20"
          : "border-slate-500 hover:bg-gray-800"}
          ${highlighted && !isOpen ? "tutorial-highlight" : ""}"
        aria-expanded=${isOpen}
        @click=${() => {
          this.openFolder = isOpen ? null : folder.id;
          this.requestUpdate();
        }}
      >
        <img src=${folder.icon} alt="" class="size-4" />
        <span>${translateText("unit_display.folder." + folder.id)}</span>
        ${folder.items.some((i) => i.count !== null)
          ? html`<span class="text-gray-400">${renderNumber(total)}</span>`
          : null}
      </button>
    `;
  }

  private renderUnitItem(
    icon: string,
    number: number | null,
    unitType: PlayerBuildableUnitType,
    structureKey: string,
    hotkey: string,
  ) {
    if (this.game.config().isUnitDisabled(unitType)) {
      return html``;
    }
    const selected = this.uiState.ghostStructure === unitType;
    const hovered = this._hoveredUnit === unitType;
    const displayHotkey = hotkey
      .replace("Digit", "")
      .replace("Key", "")
      .toUpperCase();

    return html`
      <div
        class="flex flex-col items-center relative"
        @mouseenter=${() => {
          this._hoveredUnit = unitType;
          this.requestUpdate();
        }}
        @mouseleave=${() => {
          this._hoveredUnit = null;
          this.requestUpdate();
        }}
      >
        ${hovered
          ? html`
              <div
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-gray-200 text-center w-max text-xs bg-gray-800/90 backdrop-blur-xs rounded-sm p-1 z-[100] shadow-lg pointer-events-none"
              >
                <div class="font-bold text-sm mb-1">
                  ${translateText(
                    "unit_type." + structureKey,
                  )}${` [${displayHotkey}]`}
                </div>
                <div class="p-2">
                  ${translateText("build_menu.desc." + structureKey)}
                </div>
                ${unitType === UnitType.Warship
                  ? html`<div
                      class="mt-1 px-2 py-1 text-[10px] text-cyan-300 border-t border-white/10"
                    >
                      ⇧ ${translateText("build_menu.warship_shift_hint")}
                    </div>`
                  : null}
                <div class="flex items-center justify-center gap-1">
                  <img src=${goldCoinIcon} width="13" height="13" />
                  <span class="text-yellow-300"
                    >${renderNumber(this.cost(unitType))}</span
                  >
                </div>
              </div>
            `
          : null}
        <div
          class="${this.canBuild(unitType)
            ? ""
            : "opacity-40"} border border-slate-500 rounded-sm px-0.5 pb-0.5 flex items-center gap-0.5 cursor-pointer
             ${selected ? "hover:bg-gray-400/10" : "hover:bg-gray-800"}
             rounded-sm text-white ${selected ? "bg-slate-400/20" : ""}
             ${this.tutorialHighlight === unitType ? "tutorial-highlight" : ""}"
          @click=${() => {
            if (selected) {
              this.uiState.ghostStructure = null;
            } else if (this.canBuild(unitType)) {
              this.uiState.ghostStructure = unitType;
            }
            this.requestUpdate();
          }}
          @mouseenter=${() => {
            switch (unitType) {
              case UnitType.AtomBomb:
              case UnitType.HydrogenBomb:
                this.eventBus?.emit(
                  new ToggleStructureEvent([
                    UnitType.MissileSilo,
                    UnitType.SAMLauncher,
                  ]),
                );
                break;
              case UnitType.Warship:
              case UnitType.Submarine:
              case UnitType.AircraftCarrier:
                this.eventBus?.emit(
                  new ToggleStructureEvent([UnitType.MilitaryPort]),
                );
                break;
              default:
                this.eventBus?.emit(new ToggleStructureEvent([unitType]));
            }
          }}
          @mouseleave=${() =>
            this.eventBus?.emit(new ToggleStructureEvent(null))}
        >
          ${html`<div class="ml-0.5 text-[10px] relative -top-1 text-gray-400">
            ${displayHotkey}
          </div>`}
          <div class="flex items-center gap-0.5 pt-0.5">
            <img src=${icon} alt=${structureKey} class="align-middle size-5" />
            ${number !== null
              ? html`<span class="text-xs">${renderNumber(number)}</span>`
              : null}
          </div>
        </div>
      </div>
    `;
  }
}
