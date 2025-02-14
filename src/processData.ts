import * as fs from 'fs';
import * as https from 'https';
import { IncomingMessage } from 'http';
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { ChainBuilder } from './chainBuilder';
import { PassThrough, pipeline } from 'stream';

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
                station_type: rest.station_type ?? 'undefined' as any,
                name: rest.name ?? 'undefined' as any,
                eightd_has_key_dispenser: rest.eightd_has_key_dispenser ?? 'undefined' as any,
                has_kiosk: rest.has_kiosk ?? 'undefined' as any,
                lat: rest.lat ?? 'undefined' as any,
                electric_bike_surcharge_waiver: rest.electric_bike_surcharge_waiver ?? 'undefined' as any,
                short_name: rest.short_name ?? 'undefined' as any,
                lon: rest.lon ?? 'undefined' as any,
                capacity: rest.capacity ?? 'undefined' as any,
                externalId: external_id ?? 'undefined' as any,
                stationId: station_id ?? 'undefined' as any,
                legacyId: legacy_id ?? 'undefined' as any,
                address: rest.address ?? 'undefined' as any,
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
      https.get(url, (res) => {
        resolve(res);
      }).on('error', (error) => { reject(error); });
    });

    return new Promise<any>((resolve, reject) => {
      try {
        const stationsInCapacity = { capacity: MAX_CAPACITY, count: 0 };
        const fileWriter = fs.createWriteStream('/tmp/data.csv');
        const chainBuilder = new ChainBuilder(json, fileWriter);

        const { chain, csv } = chainBuilder.getChain(stationsInCapacity);

        csv.on('end', () => {
          resolve(fileWriter.end());
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async processAWS(url: string): Promise<any> {
    const FILE_OUTPUT = process.env.FILE_OUTPUT || "LOCAL";

    const s3 = new S3Client();
    const passThrough = new PassThrough();

    const upload = new Upload({
      client: s3,
      params: {
        Bucket: FILE_OUTPUT,
        Key: 'data.csv',
        Body: passThrough,
      },
    });

    const stationsInCapacity = { capacity: 12, count: 0 };
    const chainBuilder = new ChainBuilder({} as any, passThrough);
    const rawPipeline = chainBuilder.getPipelineRaw(stationsInCapacity);

    const processingPipeline = new Promise<void>((resolve, reject) => {
      https.get(url, (res) => {
        rawPipeline[0] = res;

        pipeline(rawPipeline, (err) => {
          if (err) {
            return reject(err);
          }

          resolve();
        });
      }).on('error', (error) => { reject(error); });
    });

    return Promise.all([
      processingPipeline,
      upload.done()
    ]);
  }
} 
