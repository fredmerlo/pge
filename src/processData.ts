
export interface IBaseStation {
  station_type?: string;
  lat?: number;
  electric_bike_surcharge_waiver?: boolean;
  name?: string;
  capacity: number;
  short_name?: string;
  eightd_has_key_dispenser?: boolean;
  has_kiosk?: boolean;
  lon?: number;
  address?: string;
}

export interface IStation extends IBaseStation {
  station_id: string;
  external_id: string;
  legacy_id?: string;
  rental_methods?: any;
  rental_uris?: any;
  eightd_station_services?: any;
}

export interface IRenamedStation extends IBaseStation {
  stationId: string;
  externalId: string;
  legacyId?: string;
}

export interface IData {
  last_updated: number;
  ttl: number;
  version: string;
  data: {
    stations: IStation[];
  };
}

const MAX_CAPACITY = 12;
const SHARD_SIZE = 500;

export class ProcessData {
  async process(data: string): Promise<IRenamedStation[]> {
    const parsed = await new Promise<any>((resolve, reject) => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    const stations = parsed.data.stations
    console.log(`Processing ${stations.length} stations`);

    const wholeShards = Math.trunc(stations.length / SHARD_SIZE);
    const partialShard = stations.length % SHARD_SIZE;
    const shardIndexes = Array.from({ length: wholeShards + (partialShard > 0 ? 1 : 0) }, (_, i) => i * SHARD_SIZE);

    const stationsList = await Promise.all(
      shardIndexes.map(async (startIndex: number) => {
        const shard = stations.slice(startIndex, startIndex + SHARD_SIZE);
        const processedShard = shard.map((station: IStation) => {
          if (station.capacity < MAX_CAPACITY) {
            const { rental_methods, rental_uris, eightd_station_services, external_id, station_id, legacy_id, ...rest } = station;
            const renamedStation: IRenamedStation = {
              ...rest,
              externalId: external_id,
              stationId: station_id,
              legacyId: legacy_id
            };
            return renamedStation;
          }
          return null;
        });
        return processedShard;
      })
    );
    const filteredStations = stationsList.flatMap((station) => station).filter((station) => station !== null);
    console.log(`Returning ${filteredStations.length} stations`);
    return filteredStations;
  }
} 
