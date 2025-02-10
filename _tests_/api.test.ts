import * as Hapi from '@hapi/hapi';
import { Api } from '../src/api';
import { HttpClient } from '../src/httpClient';
import { ProcessData } from '../src/processData';
import { CsvData } from '../src/csvData';
import { Authorizer } from '../src/authorizer';
import { CommonPlugins } from '../src/commonplugins';
import { ResponseToolkit } from '@hapi/hapi';
import * as inert from '@hapi/inert';

jest.mock('../src/httpClient');
jest.mock('../src/processData');
jest.mock('../src/csvData');

describe('Api', () => {
  let server: Hapi.Server;
  let httpClient: HttpClient;
  let processor: ProcessData;
  let csvData: CsvData;
  let authorizer: Authorizer;
  let commonPlugins: CommonPlugins
  let api: Api;

  beforeEach(() => {
    server = new Hapi.Server();
    httpClient = new HttpClient() as jest.Mocked<HttpClient>;
    processor = new ProcessData() as jest.Mocked<ProcessData>;
    csvData = new CsvData() as jest.Mocked<CsvData>;
    authorizer = new Authorizer();
    commonPlugins = new CommonPlugins();

    api = new Api();
    api.server = server;
    api.httpClient = httpClient;
    api.processor = processor;
    api.csvData = csvData;
    api.authorizer = authorizer;
    api.commonPlugins = commonPlugins;

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
    // @ts-ignore
    server.decorate('toolkit', 'file', (request, h) => { }, { extend: true, apply: true });

    (httpClient.head as jest.Mock).mockResolvedValue({ lastModified: undefined, etag: 'undefined' });

    const postRoute = await server.inject({ method: 'POST', url: '/token', headers: { authorization: 'Basic ' + (Buffer.from('test:supersecret', 'utf8')).toString('base64') } });
    const getRoute = await server.inject({ method: 'GET', url: '/data', headers: { authorization: 'Bearer ' + (postRoute.result as any).token } },);

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
    const getRoute = await server.inject({ method: 'GET', url: '/data', headers: { authorization: 'Bearer ' + (postRoute.result as any).token } });

    expect(getRoute.statusCode).toBe(500);
    // expect(httpClient.get).toHaveBeenCalledWith('https://gbfs.citibikenyc.com/gbfs/en/station_information.json');
    expect(httpClient.get).toHaveBeenCalledWith('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
  });
  it('should GET /data from cached file', async () => {
    await api.init();

    const response: any = jest.fn().mockReturnThis();
    response.code = jest.fn().mockReturnThis();
    response.code.mockReturnValue(200);
    response.encoding = jest.fn().mockReturnThis();
    response.type = jest.fn().mockReturnThis();
    response.header = jest.fn().mockReturnThis();

    const fileHandle: ResponseToolkit<Hapi.ReqRefDefaults> = {
      file: jest.fn((path: string, options?: inert.ReplyFileHandlerOptions) => response),
      abandon: {} as any,
      close: {} as any,
      context: jest.fn(),
      continue: {} as any,
      realm: {} as any,
      request: {} as any,
      authenticated: jest.fn(),
      entity: jest.fn(),
      redirect: jest.fn(),
      response: response,
      state: jest.fn(),
      unauthenticated: jest.fn(),
      unstate: jest.fn()
    }
    // @ts-ignore
    server.decorate('toolkit', 'file', (request, h) => { return fileHandle.file; }, { extend: true, apply: true });
    server.app = { lastEtag: 'undefined' };

    (httpClient.head as jest.Mock).mockResolvedValue({ lastModified: undefined, etag: 'undefined' });

    const postRoute = await server.inject({ method: 'POST', url: '/token', headers: { authorization: 'Basic ' + (Buffer.from('test:supersecret', 'utf8')).toString('base64') } });
    const getRoute = await server.inject({ method: 'GET', url: '/data', headers: { authorization: 'Bearer ' + (postRoute.result as any).token } },);

    expect(fileHandle.file).toHaveBeenCalledWith('/tmp/data.csv', { confine: false, mode: 'inline' });
    expect(getRoute.statusCode).toBe(200);
  });
  it('should GET /data as redirect using S3 presignedurl', async () => {
    process.env.FILE_OUTPUT = 'S3_BUCKET_NAME';
    await api.init();
    server.app = { lastEtag: 'undefined' };

    (httpClient.head as jest.Mock).mockResolvedValue({ lastModified: undefined, etag: 'undefined' });
    
    csvData.s3Url = jest.fn().mockResolvedValue('https://localhost/S3_BUCKET_NAME/data.csv');

    await csvData.s3Url();

    const postRoute = await server.inject({ method: 'POST', url: '/token', headers: { authorization: 'Basic ' + (Buffer.from('test:supersecret', 'utf8')).toString('base64') } });
    const getRoute = await server.inject({ method: 'GET', url: '/data', headers: { authorization: 'Bearer ' + (postRoute.result as any).token } },);

    expect(getRoute.statusCode).toBe(302);
    expect(getRoute.headers.location).toBe('https://localhost/S3_BUCKET_NAME/data.csv');
  });
});
