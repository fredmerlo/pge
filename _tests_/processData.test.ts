import { ProcessData } from '../src/processData';
import * as File from 'fs';
describe('ProcessData', () => {
  it('should parse and process data correctly', async () => {
    const data = JSON.stringify({
      last_updated: 123456789,
      ttl: 60,
      version: '1.0',
      data: {
        stations: [
          {
            station_id: '1',
            external_id: 'ext1',
            lat: 40.712776,
            lon: -74.005974,
            name: 'Station 1',
            capacity: 10,
            short_name: 'S1',
            station_type: 'type1',
            rental_uris: {
              android: 'https://example.com/android',
              ios: 'https://example.com/ios'
            },
            rental_methods: ['method1', 'method2'],
            legacy_id: 'leg1',
            "eightd_station_services": [],
          },
          {
            station_id: '3',
            external_id: 'ext3',
            lat: 40.712776,
            lon: -74.005974,
            name: 'Station 3',
            capacity: 10,
            short_name: 'S3',
            station_type: 'type1',
            rental_uris: {
              android: 'https://example.com/android',
              ios: 'https://example.com/ios'
            },
            rental_methods: ['method1', 'method2'],
            address: '123 Main St.',
            "eightd_station_services": [],
          },
          {
            station_id: '2',
            external_id: 'ext2',
            lat: 34.052235,
            lon: -118.243683,
            name: 'Station 2',
            capacity: 15,
            short_name: 'S2',
            station_type: 'type2',
            rental_uris: {
              android: 'https://example.com/android',
              ios: 'https://example.com/ios'
            },
            rental_methods: ['method1', 'method2'],
            legacy_id: 'leg2',
            "eightd_station_services": [],
          }
        ]
      }
    });

    // const data2 = File.readFileSync('data.json', 'utf8');

    const processData = new ProcessData();
    const result = await processData.process(data);

    console.log(result.length);

    // expect(result).toBeTruthy();
    expect(result).toEqual([
      {
        stationId: '1',
        externalId: 'ext1',
        lat: 40.712776,
        lon: -74.005974,
        name: 'Station 1',
        capacity: 10,
        short_name: 'S1',
        station_type: 'type1',
        legacyId: 'leg1',
        address: 'undefined',
        eightd_has_key_dispenser: 'undefined',
        electric_bike_surcharge_waiver: 'undefined',
        has_kiosk: 'undefined',
      },
      {
        stationId: '3',
        externalId: 'ext3',
        lat: 40.712776,
        lon: -74.005974,
        name: 'Station 3',
        capacity: 10,
        short_name: 'S3',
        station_type: 'type1',
        address: '123 Main St.',
        eightd_has_key_dispenser: 'undefined',
        electric_bike_surcharge_waiver: 'undefined',
        has_kiosk: 'undefined',
        legacyId: 'undefined',
      }
    ]);
  });

  it('should return an empty array if no stations have capacity less than 12', async () => {
    const data = JSON.stringify({
      last_updated: 123456789,
      ttl: 60,
      version: '1.0',
      data: {
        stations: [
          {
            station_id: '1',
            external_id: 'ext1',
            lat: 40.712776,
            lon: -74.005974,
            name: 'Station 1',
            capacity: 15,
            short_name: 'S1',
            station_type: 'type1'
          },
          {
            station_id: '2',
            external_id: 'ext2',
            lat: 34.052235,
            lon: -118.243683,
            name: 'Station 2',
            capacity: 20,
            short_name: 'S2',
            station_type: 'type2'
          }
        ]
      }
    });

    const processData = new ProcessData();
    const result = await processData.process(data);

    expect(result).toEqual([]);
  });

  it('should handle empty stations array', async () => {
    const data = JSON.stringify({
      last_updated: 123456789,
      ttl: 60,
      version: '1.0',
      data: {
        stations: []
      }
    });

    const processData = new ProcessData();
    const result = await processData.process(data);

    expect(result).toEqual([]);
  });
});
