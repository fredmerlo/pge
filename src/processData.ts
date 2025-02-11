import * as fs from 'fs';
import * as https from 'https';
import { IncomingMessage } from 'http';
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { MemoryReader } from './streams/memoryReader';
import { MemoryWriter } from './streams/memoryWriter';
import { PayloadBuffer } from './streams/payloadBuffer';
import { ChainBuilder } from './streams/chainBuilder';

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
      https.get(url, (res) => {
        res.readableObjectMode
        resolve(res);
      }).on('error', (error) => { reject(error); });
    });

    return new Promise<void>((resolve, reject) => {
      const stationsInCapacity = { count: 0 };
      const fileWriter = fs.createWriteStream('/tmp/data.csv');
      const chainBuilder = new ChainBuilder(json, fileWriter);

      const ch = chainBuilder.getChain(stationsInCapacity);

      ch.on('end', () => {
        resolve();
      });
    });
  }

  async processAWS(url: string): Promise<void> {
    const FILE_OUTPUT = process.env.FILE_OUTPUT || "LOCAL";

    const json = await new Promise<IncomingMessage>((resolve, reject) => {
      https.get(url, (res) => {
        res.readableObjectMode
        resolve(res);
      }).on('error', (error) => { reject(error); });
    });

    const s3 = new S3Client();

    const prom = new Promise<Upload>((resolve, reject) => {
      const stationsInCapacity = { count: 0 };
      const payloadBuffer = new PayloadBuffer();
      const memoryReader = new MemoryReader(payloadBuffer);
      const memoryWriter = new MemoryWriter(payloadBuffer);
      const chainBuilder = new ChainBuilder(json, memoryWriter);

      const ch = chainBuilder.getChain(stationsInCapacity);

      memoryWriter.on('end', async () => {
        resolve(new Upload({
          client: s3,
          params: {
            Bucket: FILE_OUTPUT,
            Key: 'data.csv',
            Body: memoryReader,
          },
        }));
      });
    });

    const pipe = await prom;
    await pipe.done();
  }
} 
