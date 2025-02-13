import { Transform, TransformOptions } from 'node:stream';
import { TransformCallback } from 'stream';
import { json2csv } from 'json-2-csv';
import { IRenamedStation, IStation } from "./processData";

export interface Station {
  capacity: number;
  count: number;
}

export interface StationOptions {
  station: Station;
}
export class CsvTransform extends Transform {
  opts: StationOptions;
  constructor(opts?: TransformOptions & StationOptions | undefined) {
    super(opts);
    this.opts = opts as StationOptions;
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    const value: IStation = chunk.value;
    const { rental_methods, rental_uris, eightd_station_services, external_id, station_id, legacy_id, ...rest } = value;
    const opts = this.opts as StationOptions;
    if (value.capacity < opts.station.capacity) {
      opts.station.count++;
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
      } as IRenamedStation], { prependHeader: opts.station.count === 1 }) + '\r\n';
      this.push(csvData);
    }

    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    this.push(null);
    this.emit('end');
    callback();
  }
}
