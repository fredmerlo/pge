# Getting Started with PG&E Stations

### Pre-Requisites
1. Install Node v22.x for your operating system

   [Node download page](https://nodejs.org/en/download/)

   To verify that Node v22.x has been correctly installed in your system.

   Use a shell terminal, run the following command:

   ```
   node --version
   ```
   This should display `v22.##.#`

2. Install Docker Desktop for your operating system

   [Docker Desktop download page](https://www.docker.com)

   To verify that Docker has been correctly installed in your system.

   Use a shell terminal, run the following command:

   ```
   docker --version
   ```
   This should display `Docker version v27.##.#`

3. Clone the repository `PG&E` into your system
   
   [GP&E GitHub Repository](https://github.com/fredmerlo/pge)

### Implementation Approach

  The solution is implemented as a Docker image for AWS Lambda, Node.Js, Typescript and Hapi (Server, Routes, Authorization, JWT, HttpClient).

  Using this strategy we gain: platform neutrality, consistent feature functionality and a single-codebase for local and cloud operations.

*Caveat Emptor*

Though we gain much with this approach, there are some nuances worth noting.

+ The primary target operating environment for AWS Lambda images is API Gateway with ECR
+ There is a noticably elevated technical complexity when usnig Lambda images.
+ There are slight variations when invoking the Rest API locally.

### The Techinical Stuff

Node and NPM are not really needed to run the project, except for the unit test, so let's start here.

After cloning the repository:

1. Run the command
   ```
   npm install
   ``` 
   This will install the necessary node modules for the project.

2. Once NPM has completed, build the project:
   ```
   npm run build
   ```

3. And run the tests
   ```
   npm run test
   ```
   The output is verbose, as intended, so there will be a few stack traces in the output. This is expected, several tests check error boundaries and the integrated logger is doing it's job to display the error condition.

4. Upon completion the test result summary will display:
   ```
   Test Suites: 4 passed, 4 total
   Tests:       13 passed, 13 total
   Snapshots:   0 total
   Time:        6.089 s
   Ran all test suites.
   ```


#### Running Local Lambda

From the local repository root directory:
1. Run the docker command to build the image
   ```
   docker buildx build --load --platform linux/amd64 --provenance=false -t pge .
   ```
   **pge** at the end of the command is the image tag.

2. After the build completes we can now run the image
   ```
   docker run --mount type=bind,src=/Users/fredmerlo/development/pge/data,dst=/processed --platform linux/amd64 -p 9000:8080 pge:test  
   ```
   Let's break-down each argument:

   + **--mount** since this is an AWS Lambda image there really is no *local* file storage per-se; to clarify, once an image has been published in ECR it is immutable. This argument binds a local directory to the image mount point **dst=/processed** this mount value is necessary for local csv file delivery and should not be modified. The **src=/some-full/host-directory** can be any path on the local system, it must be a complete path, docker mounts do not support relatve paths.
   + **--platform linux/amd64** this is the base platform for the base AWS ECR Image, this value should not be changed either.
   + **-p 9000:8080** is the port forwarding argument for the running image, though I haven't gone through the AWS ECR Image source, I suspect the container may have a hard dependency on port **8080**
   + **pge:test** is the tag that will be assigned to the running container, this can be any value.
    Now that we have the image running, we can invoke the API.

3. The solution uses JWT for API Authorization, so we need to get a token
   ```
   curl "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{"httpMethod":"POST","path":"/token","headers":{"Authorization":"Basic dGVzdDpzdXBlcnNlY3JldA=="}}'
   ```
   Argument break-down:
    
    + The Lambda uri is quite different from what we normally see in a Rest API, APIGW Proxy Integration abstracts quite a bit for us.
    + **-d** APIGW Proxy Integration invokes the Lambda only via POST, notice the uri does not have a resource path, because the posted APIGatewayEvent payload is what the Lambda uses.
    + **Basic dGVzdDpzdXBlcnNlY3JldA==** is the Base64 encoded value for *user:secret*
  
   The response will be:
   ```
   {"statusCode":200,"headers":{"content-type":"application/json; charset=utf-8","cache-control":"no-cache","content-length":260,"date":"Mon, 03 Feb 2025 17:13:48 GMT","connection":"keep-alive"},"body":"{\"token\":\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJ1cm46YXVkaWVuY2U6dGVzdCIsImlzcyI6InVybjppc3N1ZXI6cGdlIiwic3ViIjoidGVzdCIsInVzZXIiOiJ0ZXN0IiwiZ3JvdXAiOiJwZ2UiLCJleHAiOjE3Mzg2MDMwMDgsImlhdCI6MTczODYwMjgyOH0.ac38kE_0Ct-evDzM2WLfpcXctOAIokDqWAS17fdkRwk\"}"}
   ```
   There's our JWT token.
4. Now we copy the token invoke the station data API
   ```
   curl "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{"path":"/","headers":{"Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJ1cm46YXVkaWVuY2U6dGVzdCIsImlzcyI6InVybjppc3N1ZXI6cGdlIiwic3ViIjoidGVzdCIsInVzZXIiOiJ0ZXN0IiwiZ3JvdXAiOiJwZ2UiLCJleHAiOjE3Mzg2MDMyODEsImlhdCI6MTczODYwMzEwMX0.wqURjtjzXLK4sQkNN78zQb_ivuH178HP6xn9tquBhYQ"}}'
   ```
   And the response:
   ```
   {"statusCode":200,"headers":{"content-type":"application/json; charset=utf-8","cache-control":"no-cache","content-length":506,"accept-ranges":"bytes","date":"Mon, 03 Feb 2025 17:19:56 GMT","connection":"keep-alive"},"body":"{\"csv\":\"eightd_has_key_dispenser,capacity,electric_bike_surcharge_waiver,station_type,lon,name,region_id,short_name,lat,has_kiosk,externalId,stationId,legacyId\\nfalse,3,false,classic,-73.9995126,Congress St & Hicks St,71,4497.09,40.6893952,true,b516fedb-3ced-4683-8c17-7e5f6dadf04d,b516fedb-3ced-4683-8c17-7e5f6dadf04d,undefined\\nfalse,3,false,classic,-73.99807110428809,8 Ave & W 24 St,71,6224.06,40.74591072834279,true,1d440638-ec50-4ccb-9a82-0e3247a87c63,1d440638-ec50-4ccb-9a82-0e3247a87c63,undefined\"}"}
   ```
5. The processed stations CSV file will be located at the mount point directory.
   ```
   ls /Users/fredmerlo/development/pge/data
   data.csv
   ```
   
#### Invoking AWS APIGateway API
I used Terraform to provision the Rest API in AWS, although the target environments differ, the same Docker file was used to build the Lambda image and publish into ECR.

Invoking the APIGateway Rest API follows the same workflow used for the local Lambda.

1. Get the authorization token, no need to Base64 encode the user:secret these can be provided via request headers.
   ```
   curl -X POST -u "test:supersecret" "https://iaoe8o5c0e.execute-api.us-east-1.amazonaws.com/pge/token"
   ```
   The response:
   ```
   {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJ1cm46YXVkaWVuY2U6dGVzdCIsImlzcyI6InVybjppc3N1ZXI6cGdlIiwic3ViIjoidGVzdCIsInVzZXIiOiJ0ZXN0IiwiZ3JvdXAiOiJwZ2UiLCJleHAiOjE3Mzg2MDc0MjAsImlhdCI6MTczODYwNzI0MH0.HV72yn7Iq_CVDu6AbbaPSROFbjQiZPlAgKHaT4VL0Aw"}
   ```
2. Invoke the station data API
   ```
   curl "https://iaoe8o5c0e.execute-api.us-east-1.amazonaws.com/pge/data" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJ1cm46YXVkaWVuY2U6dGVzdCIsImlzcyI6InVybjppc3N1ZXI6cGdlIiwic3ViIjoidGVzdCIsInVzZXIiOiJ0ZXN0IiwiZ3JvdXAiOiJwZ2UiLCJleHAiOjE3Mzg2MDc3ODMsImlhdCI6MTczODYwNzYwM30.GeBrZcVr7kek7ddVGnl_zN5N1Vl0fgZImc4GHr6ZAC0"
   ```
   The response:
   ```
   {"csv":"capacity,has_kiosk,short_name,eightd_has_key_dispenser,lat,region_id,electric_bike_surcharge_waiver,station_type,lon,name,externalId,stationId,legacyId\n3,true,4497.09,false,40.6893952,71,false,classic,-73.9995126,Congress St & Hicks St,b516fedb-3ced-4683-8c17-7e5f6dadf04d,b516fedb-3ced-4683-8c17-7e5f6dadf04d,undefined\n3,true,6224.06,false,40.74591072834279,71,false,classic,-73.99807110428809,8 Ave & W 24 St,1d440638-ec50-4ccb-9a82-0e3247a87c63,1d440638-ec50-4ccb-9a82-0e3247a87c63,undefined"}
   ```
3. The processed stations CSV is located in the S3 bucket
   ```
   aws s3 ls pge-data-bucket
   2025-02-03 12:33:56        494 data.csv
   ```

#### Project Layout
```
.
├── Dockerfile
├── README.md
├── _tests_
│   ├── api.test.ts
│   ├── csvData.test.ts
│   ├── httpClient.test.ts
│   └── processData.test.ts
├── data
│   └── data.csv
├── jest.config.js
├── package-lock.json
├── package.json
├── src
│   ├── api.ts
│   ├── authorizer.ts
│   ├── csvData.ts
│   ├── httpClient.ts
│   ├── index.ts
│   ├── processData.ts
│   └── transformers.ts
└── tf
    ├── apigw.tf
    ├── backend.tf
    ├── main.tf
    ├── modules
    │   └── docker-build
    │       ├── main.tf
    │       ├── outputs.tf
    │       ├── variables.tf
    │       └── versions.tf
    ├── variables.tf
    └── versions.tf

```
----------------------------
|File/Directory|Description|
---------------|------------
|Dockerfile|Used for local and AWS image build
|test|Unit Tests|
|data|Mount point used for local image|
|src|Lambda Node.js source|
|tf|Terraform IaC for AWS provisioning|
