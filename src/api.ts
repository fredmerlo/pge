import * as Hapi from '@hapi/hapi';
import * as Inert from '@hapi/inert';
import { HttpClient } from './httpClient';
import { ProcessData } from './processData';
import { Authorizer } from './authorizer';
import { CsvData } from './csvData';
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
      this.server.register(Inert);

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
            let csv = '';
            try {
              // const data = await this.httpClient.get('https://gbfs.citibikenyc.com/gbfs/en/station_information.json');
              const { lastModified, etag } = await this.httpClient.head('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
              if (!etag || (this.server.app as IApiState).lastEtag !== etag) {
                const data = await this.httpClient.get('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
                const processedData = await this.processor.process(data);
                csv = await this.csvData.convert(processedData);

                await new Promise((resolve) => {
                  (this.server.app as IApiState).lastEtag = etag;
                  resolve(true);
                });
              }

              if (h.file) {
                return h.file('/tmp/data.csv', {
                  confine: false,
                  mode: 'inline'
                }).encoding('utf8').type('text/csv').code(200);
              }
              
              return h.response(csv).type('text/csv').encoding('utf8').header('content-disposition', 'inline; filename=data.csv').code(200);
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
