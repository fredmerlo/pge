import * as Hapi from '@hapi/hapi';
import * as Basic from '@hapi/basic';
import * as Jwt from '@hapi/jwt';

const secret = process.env.SECRET ?? 'supersecret';

export class Authorizer {
  public BasicAuthorizer(server: Hapi.Server) {
    server.register(Basic);
    server.auth.strategy('default', 'basic', {
      validate: async (request: any, username: string, password: string, h: any) => {
        const MAX_AGE = process.env.MAX_AGE || '3600';
        if (username === 'test' && password === secret) {
          const token = Jwt.token.generate(
            {
              aud: 'urn:audience:test',
              iss: 'urn:issuer:pge',
              sub: 'test',
              user: 'test',
              group: 'pge',
              exp: Math.floor(Date.now() / 1000) + Number.parseInt(MAX_AGE),
            },
            secret,
          );
          return { isValid: true, credentials: { token: token } };
        }

        return { isValid: false };
      }
    });
  }

  public JwtAuthorizer(server: Hapi.Server) {
    const MAX_AGE = process.env.MAX_AGE || '3600';
    server.register(Jwt);
    server.auth.strategy('jwt', 'jwt', {
      verify: {
        aud: 'urn:audience:test',
        iss: 'urn:issuer:pge',
        sub: 'test',
        maxAgeSec: Number.parseInt(MAX_AGE),
      },
      validate: async (artifacts, request, h) => {
        return { isValid: true };
      },
      keys: secret
    });

    server.auth.default('jwt');
  }
}
