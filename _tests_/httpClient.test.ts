import { HttpClient } from '../src/httpClient';
import * as wreck from '@hapi/wreck';

import * as fs from 'fs';
import * as https from 'https';
import { IncomingMessage } from 'http';

import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { ChainBuilder } from '../src/chainBuilder';
import { PassThrough, pipeline } from 'stream';

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

  it.skip('tests stream-json with chain', async () => {
    const json = await new Promise<IncomingMessage>((resolve, reject) => {
      https.get('https://gbfs.divvybikes.com/gbfs/en/station_information.json', (res) => {
        res.readableObjectMode
        resolve(res);
      }).on('error', (error) => { reject(error); });
    });

    const prom = new Promise<any>((resolve, reject) => {
      try {
        const stationsInCapacity = { capacity: 12, count: 0 };
        const fileWriter = fs.createWriteStream('output.csv');
        const chainBuilder = new ChainBuilder(json, fileWriter);

        const { chain, csv } = chainBuilder.getChain(stationsInCapacity);

        csv.on('end', () => {
          resolve(fileWriter.end());
        });
      } catch (error) {
        reject(error);
      }
    }
    );

    await prom;

  });
  it.skip('tests stream-json with pipeline to S3', async () => {
    const passThrough = new PassThrough();

    const s3 = new S3Client();
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: 'pge-data-bucket',
        Key: 'data.csv',
        Body: passThrough,
      },
    });

    const prom = new Promise<void>((resolve, reject) => {
      const stationsInCapacity = { capacity: 12, count: 0 };
      const chainBuilder = new ChainBuilder({} as any, passThrough);
      const rawPipeline = chainBuilder.getPipelineRaw(stationsInCapacity);

      https.get('https://gbfs.divvybikes.com/gbfs/en/station_information.json', (res) => {
        rawPipeline[0] = res;

        pipeline(rawPipeline, (err) => {
          if (err) {
            return reject(err);
          }

          resolve();
        });
      }).on('error', (error) => { reject(error); });
    });

    try {
      await Promise.all([
        prom, 
        upload.done()
      ]);
    } catch (error) {
      console.error(error);
    }
  });
});
