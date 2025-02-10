import * as Hapi from '@hapi/hapi';
import * as Inert from '@hapi/inert';

// @ts-ignore
const Log = require('@hapi/log/lib');

export class CommonPlugins {

  async register(server: Hapi.Server) {
    await server.register(Log);

    await server.register(Inert);
  }
}
