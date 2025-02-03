import * as Hapi from '@hapi/hapi';
import { HttpClient } from './httpClient';
import { ProcessData } from './processData';
import { Authorizer } from './authorizer';
import { CsvData } from './csvData';
const Log = require('@hapi/log/lib');

export class Api {
  public server: Hapi.Server;
  public httpClient: HttpClient;
  public processor: ProcessData;
  public authorizer: Authorizer;
  public csvData: CsvData;

  constructor() {
    this.httpClient = new HttpClient();
    this.processor = new ProcessData();
    this.authorizer = new Authorizer();
    this.csvData = new CsvData();

    this.server = Hapi.server({
      port: 3000,
      host: 'localhost',

    });
    this.server.register({ plugin: Log });

    this.authorizer.BasicAuthorizer(this.server);
    this.authorizer.JwtAuthorizer(this.server);
  }

  async init() {
    this.server.route([
      {
        method: 'GET',
        path: '/data',
        options: {
          auth: 'jwt',
        },
        handler: async (request, h) => {
          try {
            const data = await this.httpClient.get('https://gbfs.citibikenyc.com/gbfs/en/station_information.json');
            const processedData = await this.processor.process(data);
            const csv = await this.csvData.convert(processedData);
  
            return h.response({ csv }).code(200);
          } catch (error) {
            console.log(error);
            return h.response({ error: 'An error occurred' }).code(500);
          }
        },
      },
      {
        method: 'POST',
        path: '/token',
        options: {
          auth: 'default',
        },
        handler: async (request, h) => {
          return { token: request.auth.credentials.token };
        },
      },
    ]);

    return this.server;
  }
}
