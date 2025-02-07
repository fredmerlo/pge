import * as Hapi from '@hapi/hapi';
import { Api, IApiState } from '../src/api';
import { HttpClient } from '../src/httpClient';
import { ProcessData } from '../src/processData';
import { CsvData } from '../src/csvData';
import { Authorizer } from '../src/authorizer';
const Log = require('@hapi/log/lib');

jest.mock('../src/httpClient');
jest.mock('../src/processData');
jest.mock('../src/csvData');

describe('Api', () => {
  let server: Hapi.Server;
  let httpClient: HttpClient;
  let processor: ProcessData;
  let csvData: CsvData;
  let authorizer: Authorizer;
  let api: Api;

  beforeEach(() => {
    server = new Hapi.Server();
    httpClient = new HttpClient() as jest.Mocked<HttpClient>;
    processor = new ProcessData() as jest.Mocked<ProcessData>;
    csvData = new CsvData() as jest.Mocked<CsvData>;
    authorizer = new Authorizer();

    api = new Api();
    api.server = server;
    api.httpClient = httpClient;
    api.processor = processor;
    api.csvData = csvData;
    api.authorizer = authorizer;

    api.server.register({ plugin: Log });
    authorizer.BasicAuthorizer(server);
    authorizer.JwtAuthorizer(server);
  });

  it('should handle POST /token unauthorized', async () => {
    await api.init();
    const postRoute = await server.inject({ method: 'POST', url: '/token' });

    expect(postRoute.statusCode).toBe(401);
  });

  it('should handle POST /token authenticated', async () => {
    await api.init();
    const postRoute = await server.inject({ method: 'POST', url: '/token', headers: { authorization: 'Basic ' + (Buffer.from('test:supersecret', 'utf8')).toString('base64') } });

    expect(postRoute.statusCode).toBe(200);
    expect(postRoute.result).toEqual({ token: expect.any(String) });
  });

  it('should handle GET /data unauthorized', async () => {
    await api.init();
    const getRoute = await server.inject({ method: 'GET', url: '/data' });

    expect(getRoute.statusCode).toBe(401);
  });
  it('should handle GET /data authenticated', async () => {
    await api.init();
    (httpClient.head as jest.Mock).mockResolvedValue({ lastModified: undefined, etag: undefined });

    const postRoute = await server.inject({ method: 'POST', url: '/token', headers: { authorization: 'Basic ' + (Buffer.from('test:supersecret', 'utf8')).toString('base64') } });
    const getRoute = await server.inject({ method: 'GET', url: '/data', headers: { authorization: 'Bearer ' + ( postRoute.result as any ).token } });

    expect(getRoute.statusCode).toBe(200);
    // expect(httpClient.get).toHaveBeenCalledWith('https://gbfs.citibikenyc.com/gbfs/en/station_information.json');
    expect(httpClient.get).toHaveBeenCalledWith('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
    expect(processor.process).toHaveBeenCalled();
    expect(csvData.convert).toHaveBeenCalled();
  });
  it('should handle GET /data Internal Server Error', async () => {
    api.processor.process = jest.fn().mockRejectedValue(new Error('mockError'));
    
    await api.init();
    (httpClient.head as jest.Mock).mockResolvedValue({ lastModified: undefined, etag: undefined });

    const postRoute = await server.inject({ method: 'POST', url: '/token', headers: { authorization: 'Basic ' + (Buffer.from('test:supersecret', 'utf8')).toString('base64') } });
    const getRoute = await server.inject({ method: 'GET', url: '/data', headers: { authorization: 'Bearer ' + ( postRoute.result as any ).token } });

    expect(getRoute.statusCode).toBe(500);
    // expect(httpClient.get).toHaveBeenCalledWith('https://gbfs.citibikenyc.com/gbfs/en/station_information.json');
    expect(httpClient.get).toHaveBeenCalledWith('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
  });
});
