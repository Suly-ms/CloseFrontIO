import { GameMapSize, GameMapType } from "@closefront/engine-api/game/GameTypes";
import {
  loadTerrainMap,
  TerrainMapData,
} from "@closefront/engine-lib/game/TerrainMapLoader";
import { assetUrl } from "@closefront/shared/AssetUrls";
import { FetchGameMapLoader } from "@closefront/shared/FetchGameMapLoader";
import { loadMapFiles } from "@closefront/shared/GameMapLoader";

export const terrainMapFileLoader = new FetchGameMapLoader((path) =>
  assetUrl(`maps/${path}`),
);

const terrainMaps = new Map<string, TerrainMapData>();

/** The maps the client draws on, built once per map and size. */
export async function loadCachedTerrainMap(
  map: GameMapType,
  mapSize: GameMapSize,
): Promise<TerrainMapData> {
  const key = `${map}:${mapSize}`;
  const cached = terrainMaps.get(key);
  if (cached !== undefined) return cached;
  const terrain = await loadTerrainMap(
    await loadMapFiles(terrainMapFileLoader, map, mapSize),
  );
  terrainMaps.set(key, terrain);
  return terrain;
}
