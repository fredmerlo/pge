import * as Hapi from '@hapi/hapi';
import { HttpClient } from './httpClient';
import { ProcessData } from './processData';
import { Authorizer } from './authorizer';
import { CsvData } from './csvData';
import { CommonPlugins } from './commonplugins';

export interface IApiState extends Hapi.ServerApplicationState {
  isInitialized: boolean;
  lastEtag?: string;
}

export class Api {
  public server: Hapi.Server;

  public httpClient!: HttpClient;
  public processor!: ProcessData;
  public authorizer!: Authorizer;
  public csvData!: CsvData;
  public commonPlugins!: CommonPlugins;

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
      this.commonPlugins = new CommonPlugins();

      this.authorizer.BasicAuthorizer(this.server);
      this.authorizer.JwtAuthorizer(this.server);

      console.log('Api Instance');
    }
  }

  async init() {
    if (!(this.server.app as IApiState).isInitialized) {
      await this.commonPlugins.register(this.server);
      this.server.route([
        {
          method: 'GET',
          path: '/data',
          options: {
            auth: 'jwt',
          },
          handler: async (request, h) => {
            const isLocal = (process.env.FILE_OUTPUT || "LOCAL") === "LOCAL";

            try {
              const { lastModified, etag } = await this.httpClient.head('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
              const isNewEtag = !etag || (this.server.app as IApiState).lastEtag !== etag;

              if (isNewEtag) {
                const data = await this.httpClient.get('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
                const processedData = await this.processor.process(data);
                const csv = await this.csvData.convert(processedData);
                (this.server.app as IApiState).lastEtag = etag;

                // if (isLocal) {
                //   await this.processor.processLocal('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
                // } else {
                //   await this.processor.processAWS('https://gbfs.divvybikes.com/gbfs/en/station_information.json');
                // }

                // // New csv data was found respond with the processed payload
                return h.response(csv).type('text/csv').encoding('utf8').header('content-disposition', 'inline; filename=data.csv').code(200);
              }

              if (isLocal) {
                if (h.file) {
                  return h.file('/tmp/data.csv', {
                    confine: false,
                    mode: 'inline'
                  }).encoding('utf8').type('text/csv').code(200);
                }
              } else {
                const url = await this.csvData.s3Url();
                return h.redirect(url).type('text/csv').encoding('utf8').header('content-disposition', 'inline; filename=data.csv').code(302);
              }
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
        {
          method: 'GET',
          path: '/csv',
          options: {
            auth: 'jwt',
          },
          handler: async (request, h) => {
            file: '/tmp/data.csv';

            return h.file('/tmp/data.csv');
          },
        },
      ]);

      (this.server.app as IApiState).isInitialized = true;
      console.log('Api initialized');
    }

    return this.server;
  }
}
