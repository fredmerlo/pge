import { HttpClient } from '../src/httpClient';
import * as wreck from '@hapi/wreck';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';

import * as fs from 'fs';
import { Transform } from 'stream';
import * as https from 'https';
import { IncomingMessage } from 'http';
import { json2csv } from 'json-2-csv';

jest.mock('@hapi/wreck');

describe('HttpClient', () => {
  let httpClient: HttpClient;

  beforeEach(() => {
    httpClient = new HttpClient();
  });

  it('should fetch data from the given URL', async () => {
    const mockPayload = 'mock data';
    (wreck.get as jest.Mock).mockResolvedValue({
      res: {},
      payload: mockPayload
    });
    (wreck.request as jest.Mock).mockResolvedValue({
      headersDistinct: {
        'last-modified': 'last-modified',
        etag: 'etag'
      }
    });

    const url = 'https://example.com/data';
    const result = await httpClient.get(url);

    expect(wreck.get).toHaveBeenCalledWith(url);
    expect(result).toEqual(mockPayload);
  });

  it('should log the correct messages', async () => {
    const mockPayload = 'mock data';
    (wreck.get as jest.Mock).mockResolvedValue({
      res: {},
      payload: mockPayload
    });
    (wreck.request as jest.Mock).mockResolvedValue({
      headersDistinct: {
        'last-modified': 'last-modified',
        etag: 'etag'
      }
    });

    const url = 'https://example.com/data';
    console.log = jest.fn();

    await httpClient.get(url);

    expect(console.log).toHaveBeenCalledWith(`Fetching data from ${url}`);
    expect(console.log).toHaveBeenCalledWith(`Received data ${mockPayload.length} bytes from ${url}`);
  });
  it('should fetch data from the local cache', async () => {
    const mockPayload = 'mock data';
    (wreck.get as jest.Mock).mockResolvedValue({
      res: {},
      payload: mockPayload
    });
    (wreck.request as jest.Mock).mockResolvedValue({
      headersDistinct: {
        'last-modified': undefined,
        etag: undefined
      }
    });

    const url = 'https://example.com/data';
    console.log = jest.fn();

    await httpClient.get(url);

    expect(console.log).toHaveBeenCalledWith(`Data not modified`);
  });
  it('tests stream-json', async () => {
    const json = await new Promise<IncomingMessage>((resolve, reject) => {
      https.get('https://gbfs.divvybikes.com/gbfs/en/station_information.json', (res) => {
        res.readableObjectMode
        resolve(res);
      }).on('error', (error) => { reject(error); });
    });

    const transformer = new Transform({
      objectMode: false,
      transform(chunk: any, encoding, callback) {
  
        const chunkStr = chunk.toString('utf8');

        this.push(chunkStr);

        callback();
      },
    });
    const csv = fs.createWriteStream('output.csv', { encoding: 'utf8' });

    let stationsProcessed: number = 0;
    let stationsInCapacity: number = 0;

    json
      .pipe(parser())
      .pipe(pick({ filter: /\bstations\b/ }))
      .pipe(streamArray({ objectMode: false }))
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

    transformer.pipe(csv);
  });
})
