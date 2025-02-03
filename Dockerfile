FROM public.ecr.aws/lambda/nodejs:22 as node
WORKDIR /usr/app
COPY package.json ./
RUN npm install

FROM node as builder
WORKDIR /usr/app
COPY src/*.ts ./
RUN npm run buildLambda
    
FROM public.ecr.aws/lambda/nodejs:22
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/dist/* ./
ENV SECRET=supersecret
VOLUME /processed
CMD ["index.handler"]
