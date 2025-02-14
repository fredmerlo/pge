import { Transform, TransformOptions } from 'node:stream';
import { TransformCallback } from 'stream';
import { IStation } from "./processData";
import { toCsv } from '@iwsio/json-csv-core';

export interface Station {
  capacity: number;
  count: number;
}

export interface StationOptions {
  station: Station;
}

type Condition = () => boolean;

export class CsvTransform extends Transform {
  opts: StationOptions;
  batchSize: number;
  batch: any[] = [];
  csvFields: any[] = [
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
  ];

  constructor(opts?: TransformOptions & StationOptions & { batchSize?: number } | undefined) {
    super(opts);
    this.opts = opts as StationOptions;
    this.batchSize = opts?.batchSize ?? 5000;
  }

  pushBatch(pushIf: Condition): void {
    if (pushIf()) {
      const csvData = toCsv(this.batch, {
        fields: this.csvFields,
        ignoreHeader: this.opts.station.count !== this.batch.length
      });
      this.push(csvData);
      this.batch = [];
    }
  }
  
  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    const value: IStation = chunk.value;
    const { rental_methods, rental_uris, eightd_station_services, external_id, station_id, legacy_id, ...rest } = value;
    const opts = this.opts as StationOptions;

    if (value.capacity < opts.station.capacity) {
      opts.station.count++;
      // station_type,name,eightd_has_key_dispenser,has_kiosk,lat,electric_bike_surcharge_waiver,short_name,lon,capacity,externalId,stationId,legacyId,address
      const data: { [key: string]: unknown } = {
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
      };
      this.batch.push(data);
      this.pushBatch(() => this.batch.length >= this.batchSize);
    }

    callback();
  }

  _flush(callback: TransformCallback): void {
    this.pushBatch(() => this.batch.length > 0);

    callback();
  }
}
