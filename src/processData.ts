import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { disassembler } from 'stream-json/Disassembler';
import { batch } from 'stream-json/utils/Batch';
import { chain } from 'stream-chain';
import * as fs from 'fs';
import * as https from 'https';
import { IncomingMessage } from 'http';
import { json2csv } from 'json-2-csv';
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough, Transform, Readable, ReadableOptions } from 'node:stream';
import { S3Client } from "@aws-sdk/client-s3";

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

  async processLocal(url: string): Promise<void> {
    const json = await new Promise<IncomingMessage>((resolve, reject) => {
      https.get('https://gbfs.divvybikes.com/gbfs/en/station_information.json', (res) => {
        res.readableObjectMode
        resolve(res);
      }).on('error', (error) => { reject(error); });
    });

    return new Promise<void>((resolve, reject) => {
      const csv = new Transform({
        readableObjectMode: false,
        writableObjectMode: true,
        encoding: 'utf8',
        transform(chunk, encoding, callback) {
          if (chunk.name === 'stringValue' && chunk.value && chunk.value.length) {
            const encodedChunk = chunk.value.toString(encoding);
            this.push(encodedChunk);
          }
          callback();
        },
      });

      let stationsInCapacity: number = 0;
      const ch = chain([
        json,
        parser(),
        pick({ filter: /\bstations\b/ }),
        streamArray(),
        data => {
          const value: IStation = data.value;
          const { rental_methods, rental_uris, eightd_station_services, external_id, station_id, legacy_id, ...rest } = value;
          if (data.value.capacity < 12) {
            stationsInCapacity++;
            // station_type,name,eightd_has_key_dispenser,has_kiosk,lat,electric_bike_surcharge_waiver,short_name,lon,capacity,externalId,stationId,legacyId,address
            return json2csv([{
              station_type: rest.station_type,
              name: rest.name,
              eightd_has_key_dispenser: rest.eightd_has_key_dispenser,
              has_kiosk: rest.has_kiosk,
              lat: rest.lat,
              electric_bike_surcharge_waiver: rest.electric_bike_surcharge_waiver,
              short_name: rest.short_name,
              lon: rest.lon,
              capacity: rest.capacity,
              externalId: external_id,
              stationId: station_id,
              legacyId: legacy_id,
              address: rest.address
            } as IRenamedStation], { prependHeader: stationsInCapacity === 1 }) + '\r\n'
          }
          return null;
        },
        batch({ batchSize: 500 }),
        disassembler(),
        csv,
        fs.createWriteStream('/tmp/data.csv')
      ]);

      ch.on('end', () => {
        resolve();
      });
    });
  }

  async processAWS(url: string): Promise<void> {
    const FILE_OUTPUT = process.env.FILE_OUTPUT || "LOCAL";

    const json = await new Promise<IncomingMessage>((resolve, reject) => {
      https.get('https://gbfs.divvybikes.com/gbfs/en/station_information.json', (res) => {
        res.readableObjectMode
        resolve(res);
      }).on('error', (error) => { reject(error); });
    });

    const s3 = new S3Client();

    let contentLength = 0;

    class Memory extends Readable {
      public _offset: number = 0;
      public readableLength: number = 0;

      constructor(opts?: ReadableOptions & { readableLength: number, bodyLengthChecker: (body: any) => any }) {
        super(opts);
      }
      locked: boolean = false;
    }

    const prom = new Promise<Upload>((resolve, reject) => {
      const rows = new Array<string>();
      const csv = new Transform({
        readableObjectMode: false,
        writableObjectMode: true,
        encoding: 'utf8',

        transform(chunk, encoding, callback) {
          if (chunk.name === 'stringValue' && chunk.value && chunk.value.length) {
            const encodedChunk = chunk.value.toString(encoding);
            contentLength += encodedChunk.length;
            rows.push(encodedChunk);
            this.push(encodedChunk);
          }
          callback();
        },
      });

      const output = fs.createWriteStream('/dev/null');
      const passThrough = new PassThrough();

      let stationsInCapacity: number = 0;
      const ch = chain([
        json,
        parser(),
        pick({ filter: /\bstations\b/ }),
        streamArray(),
        data => {
          const value: IStation = data.value;
          const { rental_methods, rental_uris, eightd_station_services, external_id, station_id, legacy_id, ...rest } = value;
          if (data.value.capacity < 12) {
            stationsInCapacity++;
            // station_type,name,eightd_has_key_dispenser,has_kiosk,lat,electric_bike_surcharge_waiver,short_name,lon,capacity,externalId,stationId,legacyId,address
            return json2csv([{
              station_type: rest.station_type,
              name: rest.name,
              eightd_has_key_dispenser: rest.eightd_has_key_dispenser,
              has_kiosk: rest.has_kiosk,
              lat: rest.lat,
              electric_bike_surcharge_waiver: rest.electric_bike_surcharge_waiver,
              short_name: rest.short_name,
              lon: rest.lon,
              capacity: rest.capacity,
              externalId: external_id,
              stationId: station_id,
              legacyId: legacy_id,
              address: rest.address
            } as IRenamedStation], { prependHeader: stationsInCapacity === 1 }) + '\r\n'
          }
          return null;
        },
        disassembler(),
        csv,
        output
      ]);

      ch.on('end', () => {

        const allRows = rows.join('');
        const buff = Buffer.from(allRows);

        const mem = new Memory({
          read(size) {
            if ((this as Memory)._offset === undefined) {
              (this as Memory)._offset = 0;
            }
            const chunk = buff.subarray((this as Memory)._offset, (this as Memory)._offset + size);
            (this as Memory)._offset += chunk.length;
            this.push(chunk.length > 0 ? chunk : null);
          }, objectMode: false, readableLength: contentLength, bodyLengthChecker: (body: any) => { return contentLength; }
        });

        resolve(new Upload({
          client: s3,
          params: {
            Bucket: FILE_OUTPUT,
            Key: 'data.csv',
            Body: mem,
          },
        }));
      });
    });

    const put = await prom;
    await put.done();
  }
} 
