import * as Hapi from '@hapi/hapi';
import { HttpClient } from './httpClient';
import { ProcessData } from './processData';
import { Authorizer } from './authorizer';
import { CsvData } from './csvData';
import { resolve } from 'path';
const Log = require('@hapi/log/lib');

export interface IApiState extends Hapi.ServerApplicationState {
  isInitialized: boolean;
  lastEtag?: string;
}

export class Api {
  public server: Hapi.Server;
  public httpClient: HttpClient;
  public processor: ProcessData;
  public authorizer: Authorizer;
  public csvData: CsvData;

  constructor() {

    this.server = Hapi.server<IApiState>({
      port: 3000,
      host: 'localhost',
      app: {
        isInitialized: false,
      }
    });

    if (!(this.server.app as IApiState).isInitialized) {
      this.httpClient = new HttpClient();
      this.processor = new ProcessData();
      this.authorizer = new Authorizer();
      this.csvData = new CsvData();

      this.server.register({ plugin: Log });

      this.authorizer.BasicAuthorizer(this.server);
      this.authorizer.JwtAuthorizer(this.server);

      console.log('Api Instance');
    }
  }

  async init() {
    if (!(this.server.app as IApiState).isInitialized) {
      this.server.route([
        {
          method: 'GET',
          path: '/data',
          options: {
            auth: 'jwt',
          },
          handler: async (request, h) => {
            try {
              // const data = await this.httpClient.get('https://gbfs.citibikenyc.com/gbfs/en/station_information.json');
              const { lastModified, etag } = await this.httpClient.head('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
              if (etag && (this.server.app as IApiState).lastEtag === etag) {
                const cachedCsv = await this.csvData.getFile();
                return h.response({ cachedCsv }).code(200);
              }

              await new Promise((resolve) => {
                (this.server.app as IApiState).lastEtag = etag;
                resolve(true);
              });

              const data = await this.httpClient.get('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
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

      (this.server.app as IApiState).isInitialized = true;
      console.log('Api initialized');
    }

    return this.server;
  }
}
