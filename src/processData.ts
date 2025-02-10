import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import * as fs from 'fs';
import * as https from 'https';
import { IncomingMessage } from 'http';
import { json2csv } from 'json-2-csv';
import { Transform } from 'stream';

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
    const parsed = await new Promise<IData>((resolve, reject) => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });

    return new Promise<IRenamedStation[]>((resolve, reject) => {
      try {
        const stations = parsed.data.stations
        console.log(`Processing ${stations.length} stations`);

        const wholeShards = Math.trunc(stations.length / SHARD_SIZE);
        const partialShard = stations.length % SHARD_SIZE;
        const shardIndexes = Array.from({ length: wholeShards + (partialShard > 0 ? 1 : 0) }, (_, i) => i * SHARD_SIZE);

        resolve(shardIndexes.map((startIndex: number) => {
          const shard = stations.slice(startIndex, startIndex + SHARD_SIZE);
          const processedShard: (IRenamedStation | null)[] = shard.map((station: IStation) => {
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
          return processedShard.filter((station) => station !== null);
        }).flatMap((station) => station));
      } catch (error) {
        reject(error);
      }
    });
  }

  async process2(url: string): Promise<void> {
    const json = await new Promise<IncomingMessage>((resolve, reject) => {
      https.get('https://gbfs.divvybikes.com/gbfs/en/station_information.json', (res) => {
        res.readableObjectMode
        resolve(res);
      }).on('error', (error) => { reject(error); });
    });

    return new Promise<void>((resolve, reject) => {
      const transformer = new Transform({
        objectMode: false,
        highWaterMark: 4096,
        transform(chunk: any, encoding, callback) {

          const chunkStr = chunk.toString('utf8');

          this.push(chunkStr);

          callback();
        },
      });
      const csv = fs.createWriteStream('/tmp/data.csv', { encoding: 'utf8', highWaterMark: 4096 });

      let stationsProcessed: number = 0;
      let stationsInCapacity: number = 0;

      json
        .pipe(parser())
        .pipe(pick({ filter: /\bstations\b/ }))
        .pipe(streamArray({ objectMode: true, highWaterMark: 50 }))
        .on('data', (data) => {
          const { rental_methods, rental_uris, eightd_station_services, external_id, station_id, legacy_id, ...rest } = data.value;
          if (data.value.capacity < 12) {
            stationsInCapacity++;
            transformer.write(json2csv([{
              ...rest,
              externalId: external_id,
              stationId: station_id,
              legacyId: legacy_id
            }], { prependHeader: stationsInCapacity === 1 }) + '\r\n');
          }
          stationsProcessed++;
        });

      transformer.pipe(csv)
        .on('finish', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
} 
