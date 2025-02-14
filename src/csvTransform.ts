import { Transform, TransformOptions } from 'node:stream';
import { TransformCallback } from 'stream';
import { IRenamedStation, IStation } from "./processData";
import { toCsv } from '@iwsio/json-csv-core';

export interface Station {
  capacity: number;
  count: number;
}

export interface StationOptions {
  station: Station;
}
export class CsvTransform extends Transform {
  opts: StationOptions;
  batchSize: number;
  batch: any[] = [];
  constructor(opts?: TransformOptions & StationOptions & { batchSize?: number } | undefined) {
    super(opts);
    this.opts = opts as StationOptions;
    this.batchSize = opts?.batchSize ?? 250;
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    const value: IStation = chunk.value;
    const { rental_methods, rental_uris, eightd_station_services, external_id, station_id, legacy_id, ...rest } = value;
    const opts = this.opts as StationOptions;
    let data = null;

    if (value.capacity < opts.station.capacity) {
      opts.station.count++;
      // station_type,name,eightd_has_key_dispenser,has_kiosk,lat,electric_bike_surcharge_waiver,short_name,lon,capacity,externalId,stationId,legacyId,address
      data = {
        station_type: rest.station_type ?? 'undefined',
        name: rest.name ?? 'undefined',
        eightd_has_key_dispenser: rest.eightd_has_key_dispenser ?? 'undefined',
        has_kiosk: rest.has_kiosk ?? 'undefined',
        lat: rest.lat ?? 'undefined',
        electric_bike_surcharge_waiver: rest.electric_bike_surcharge_waiver ?? 'undefined',
        short_name: rest.short_name ?? 'undefined',
        lon: rest.lon ?? 'undefined',
        capacity: rest.capacity ?? 'undefined',
        externalId: external_id ?? 'undefined',
        stationId: station_id ?? 'undefined',
        legacyId: legacy_id ?? 'undefined',
        address: rest.address ?? 'undefined'
      } as { [key: string]: unknown };
      this.batch.push(data);

      if (this.batch.length >= this.batchSize) {
        console.log(this.batch.length);
        const csvData = toCsv(this.batch, {
          fields: [
            { name: 'station_type' },
            { name: 'name' },
            { name: 'eightd_has_key_dispenser' },
            { name: 'has_kiosk' },
            { name: 'lat' },
            { name: 'electric_bike_surcharge_waiver' },
            { name: 'short_name' },
            { name: 'lon' },
            { name: 'capacity' },
            { name: 'externalId' },
            { name: 'stationId' },
            { name: 'legacyId' },
            { name: 'address' }
          ],
          ignoreHeader: opts.station.count !== this.batch.length
        });
        this.batch = [];
        callback(null, csvData);
      }
    }

    if (data === null || this.batch.length > 0) {
      callback();
    }
  }

  _flush(callback: TransformCallback): void {
    console.log(this.batch.length);
    if (this.batch.length) {
      const csvData = toCsv(this.batch, {
        fields: [
          { name: 'station_type' },
          { name: 'name' },
          { name: 'eightd_has_key_dispenser' },
          { name: 'has_kiosk' },
          { name: 'lat' },
          { name: 'electric_bike_surcharge_waiver' },
          { name: 'short_name' },
          { name: 'lon' },
          { name: 'capacity' },
          { name: 'externalId' },
          { name: 'stationId' },
          { name: 'legacyId' },
          { name: 'address' }
        ],
        ignoreHeader: this.opts.station.count !== this.batch.length
      });
      callback(null, csvData);
      this.batch = [];
    } else {
      callback();
    }
  }
}
