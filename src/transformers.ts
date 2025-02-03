
export const UrlPath = (event: any, options?: any): string => {
  let url = event.path;

  if (options.stripStage) {
    const currentStage = event.requestContext ? event.requestContext.stage : null;
    if (currentStage) {
      url = url.replace(`${currentStage}/`, '');
    }
  }

  const params = event.queryStringParameters;
  if (params) {
    const qs = Object.keys(params).map(key => `${key}=${params[key]}`);
    if (qs.length > 0) {
      url += `?${qs.join('&')}`;
    }
  }

  return url;
};

export const Request = (event: any, options?: any): any => {
  const opt = {
    path: {
      stripStage: true,
    },
    ...options,
  };

  return {
    method: event.httpMethod,
    url: UrlPath(event, opt.path),
    payload: event.body,
    headers: event.headers,
    validate: false
  };  
};

export const Response = (response: any, options?: any): any => {
  const { statusCode } = response;

  const headers = {
    ...response.headers,
  };

  delete headers['content-encoding'];
  delete headers['transfer-encoding'];

  let body = response.result;
  if (typeof response.result !== 'string') {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    headers,
    body
  };
};
