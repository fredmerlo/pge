import * as Hapi from '@hapi/hapi';
import * as Inert from '@hapi/inert';
import * as Log from '@hapi/log/lib';

export class CommonPlugins {

  async register(server: Hapi.Server) {
    await server.register(Log);

    await server.register(Inert);
  }
}
