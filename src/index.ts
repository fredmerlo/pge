import { Context, APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';
import { Api } from './api';
import * as transform from './transformers';

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const api = new Api();

  const server = await api.init();

  const apiResponse = await server.inject(transform.Request(event));

  return transform.Response(apiResponse);
};
