import { IncomingMessage } from "http";
import { Writable, Transform } from "node:stream";
import * as Chain from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { disassembler } from 'stream-json/Disassembler';
import { ArrayTransform } from "./arrayTransform";
import { json2csv } from 'json-2-csv';
import { IRenamedStation, IStation } from "./processData";
import { pipeline } from "node:stream/promises";

export class ChainBuilder {
  inputStream: IncomingMessage;
  outputStream: Writable;
  csv: ArrayTransform

  constructor(inputStream: IncomingMessage, outputStream: Writable) {
    this.inputStream = inputStream;
    this.outputStream = outputStream;
    this.csv = new ArrayTransform({
      readableObjectMode: false,
      writableObjectMode: true,
      encoding: 'utf8',
    });
  }

  public getChain(stations: {capacity: number, count: number}): any {
    return Chain.chain([
      this.inputStream,
      parser(),
      pick({ filter: /\bstations\b/ }),
      streamArray(),
      data => {
        const value: IStation = data.value;
        const { rental_methods, rental_uris, eightd_station_services, external_id, station_id, legacy_id, ...rest } = value;
        if (data.value.capacity < stations.capacity) {
          stations.count ++;
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
          } as IRenamedStation], { prependHeader: stations.count === 1 }) + '\r\n'
        }
        return null;
      },
      disassembler(),
      this.csv,
      this.outputStream
    ]);
  }

  public async getPipeline(stations: {capacity: number, count: number}): Promise<any> {
    const processTransform = new Transform({
      objectMode: true,
      transform(data: any, encoding, callback) {
        const value: IStation = data.value;
        const { rental_methods, rental_uris, eightd_station_services, external_id, station_id, legacy_id, ...rest } = value;
        if (data.value.capacity < stations.capacity) {
          stations.count ++;
          // station_type,name,eightd_has_key_dispenser,has_kiosk,lat,electric_bike_surcharge_waiver,short_name,lon,capacity,externalId,stationId,legacyId,address
          const csvData = json2csv([{
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
          } as IRenamedStation], { prependHeader: stations.count === 1 }) + '\r\n';
          callback(null, csvData);
        } else {
          callback(null, null);
        }
      }
    });

    return await pipeline(
      this.inputStream,
      parser(),
      pick({ filter: /\bstations\b/ }),
      streamArray(),
      processTransform,
      disassembler(),
      this.csv,
      this.outputStream
    );
  }
}
