# Week 7 Day 4 PR — Lambda & API Gateway

## Summary

Moves the low-traffic present-to-client workflow command to a Node 24 ARM64 Lambda and
fronts it with an API Gateway HTTP API proxy route. The Lambda keeps setup in module init,
logs with Powertools structured JSON, carries a correlation ID from the proxy event, enforces
the verified-claims Firm Admin role gate, and forwards the command to the Core Case Service
instead of writing the database directly.

Adds ADR-0021 to record the per-workload ECS-versus-Lambda decision: Lambda for the moved
present-to-client workload, Fargate for the always-on Core Case Service and Tax Engine.

All AWS-shaped verification targets floci at `http://localhost:4566`; no cloud account is
used.

## Related ADR

ADR: [ADR-0021: ECS Fargate vs Lambda, decided per workload](../docs/adr/0021-ecs-vs-lambda.md)

## Testing

- `jq -e '.runtime == "nodejs24.x" and (.architectures == ["arm64"]) and .handler == "handler.handler" and .timeout < 900' lambda/present-to-client/function.json`
- `npx tsc --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node lambda/present-to-client/handler.ts`
- `jq -e '.protocolType == "HTTP" and (.routes | length == 1) and .routes[0].integrationType == "AWS_PROXY" and .routes[0].payloadFormatVersion == "2.0"' apigw/http-api.json`
- `env AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 lambda get-function-configuration --function-name taxpulse-present-to-client`
- `env AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 apigatewayv2 get-apis`
- `env AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 apigatewayv2 get-routes --api-id f28a2ed651`
- `env AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 apigatewayv2 get-integrations --api-id f28a2ed651`
- `curl -i -sS -X POST 'http://localhost:4566/_aws/execute-api/f28a2ed651/local/transitions/present-to-client' ...`
- `docker compose logs --no-color --tail=60 floci | rg 'synthetic-correlation-final-verify|lambda:taxpulse-present-to-client'`
- `npx prettier --check lambda/present-to-client/handler.ts lambda/present-to-client/function.json lambda/present-to-client/package.json lambda/present-to-client/package-lock.json apigw/http-api.json docs/adr/0021-ecs-vs-lambda.md prompt-journal/0029-lambda-api-gateway.md`

Verification output:

```text
$ jq -e '.runtime == "nodejs24.x" and (.architectures == ["arm64"]) and .handler == "handler.handler" and .timeout < 900' lambda/present-to-client/function.json
true

$ npx tsc --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node lambda/present-to-client/handler.ts
Result: passed with no TypeScript errors.

$ env AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 lambda get-function-configuration --function-name taxpulse-present-to-client --query '{Runtime:Runtime,Architectures:Architectures,Handler:Handler,State:State,Layers:Layers[*].Arn}'
{
    "Runtime": "nodejs24.x",
    "Architectures": [
        "arm64"
    ],
    "Handler": "handler.handler",
    "State": "Active",
    "Layers": [
        "arn:aws:lambda:us-east-1:000000000000:layer:taxpulse-node-powertools:1"
    ]
}

$ env AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 lambda invoke --function-name taxpulse-present-to-client ... /tmp/taxpulse-present-to-client-task1-v3-invoke-1.json
{
    "StatusCode": 200,
    "ExecutedVersion": "$LATEST"
}

$ env AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 lambda invoke --function-name taxpulse-present-to-client ... /tmp/taxpulse-present-to-client-task1-v3-invoke-2.json
{
    "StatusCode": 200,
    "ExecutedVersion": "$LATEST"
}

$ cat /tmp/taxpulse-present-to-client-task1-v3-invoke-1.json
{"body":"{\"detail\":\"Core Case Service did not accept the present-to-client command.\",\"status\":502,\"title\":\"Bad Gateway\",\"type\":\"about:blank\"}","headers":{"content-type":"application/problem+json","x-correlation-id":"synthetic-correlation-task1-warm-reuse-v3"},"statusCode":502}

$ cat /tmp/taxpulse-present-to-client-task1-v3-invoke-2.json
{"body":"{\"detail\":\"Core Case Service did not accept the present-to-client command.\",\"status\":502,\"title\":\"Bad Gateway\",\"type\":\"about:blank\"}","headers":{"content-type":"application/problem+json","x-correlation-id":"synthetic-correlation-task1-warm-reuse-v3"},"statusCode":502}

Warm-reuse log proof:
{"level":"INFO","message":"present-to-client command received","service":"present-to-client","function_name":"taxpulse-present-to-client","function_request_id":"408d2fb8-6598-45e6-b4b0-ffbe4e1093d4","correlation_id":"synthetic-correlation-task1-warm-reuse-v3","initId":"ca596822-cc7b-410d-9c54-cb191879c848","method":"POST","path":"/transitions/present-to-client"}
{"level":"INFO","message":"present-to-client command received","service":"present-to-client","function_name":"taxpulse-present-to-client","function_request_id":"a79ba5b3-5d15-44af-a478-3c5ff36c73f5","correlation_id":"synthetic-correlation-task1-warm-reuse-v3","initId":"ca596822-cc7b-410d-9c54-cb191879c848","method":"POST","path":"/transitions/present-to-client"}

$ jq -e '.protocolType == "HTTP" and (.routes | length == 1) and .routes[0].integrationType == "AWS_PROXY" and .routes[0].payloadFormatVersion == "2.0"' apigw/http-api.json
true

$ env AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 apigatewayv2 get-apis --query 'Items[?Name==`taxpulse-serverless-http-api`].{ApiId:ApiId,ProtocolType:ProtocolType,Name:Name}'
[
    {
        "ApiId": "f28a2ed651",
        "ProtocolType": "HTTP",
        "Name": "taxpulse-serverless-http-api"
    }
]

$ env AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 apigatewayv2 get-routes --api-id f28a2ed651 --query 'Items[*].{RouteKey:RouteKey,Target:Target}'
[
    {
        "RouteKey": "POST /transitions/present-to-client",
        "Target": "integrations/76d9af9c"
    }
]

$ env AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 apigatewayv2 get-integrations --api-id f28a2ed651 --query 'Items[*].{IntegrationType:IntegrationType,PayloadFormatVersion:PayloadFormatVersion,IntegrationUri:IntegrationUri}'
[
    {
        "IntegrationType": "AWS_PROXY",
        "PayloadFormatVersion": "2.0",
        "IntegrationUri": "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:taxpulse-present-to-client/invocations"
    }
]

$ curl -i -sS -X POST 'http://localhost:4566/_aws/execute-api/f28a2ed651/local/transitions/present-to-client' -H 'content-type: application/json' -H 'x-correlation-id: synthetic-correlation-final-verify' --data '{"cycleId":"11111111-1111-4111-8111-111111111111","actionItems":[{"description":"Synthetic final verification step","deadline":"2026-09-30"}]}'
HTTP/1.1 401 Unauthorized
content-length: 123
content-type: application/json
x-correlation-id: synthetic-correlation-final-verify

{"detail":"Verified actor, tenant, and role claims are required.","status":401,"title":"Unauthorized","type":"about:blank"}

Route-invocation structured log line:
{"level":"INFO","message":"present-to-client command received","service":"present-to-client","function_name":"taxpulse-present-to-client","function_request_id":"853caa0d-78d0-4940-931f-130ddf90caf8","correlation_id":"synthetic-correlation-final-verify","initId":"e2b46668-d25e-47ba-8bf0-9d6991f9ca90","method":"POST","path":"/transitions/present-to-client"}

$ time curl -sS -o /tmp/taxpulse-task3-cold.json -w 'http_status=%{http_code} total_time=%{time_total}\n' -X POST 'http://localhost:4566/_aws/execute-api/f28a2ed651/local/transitions/present-to-client' ...
http_status=401 total_time=1.150339

$ time curl -sS -o /tmp/taxpulse-task3-warm.json -w 'http_status=%{http_code} total_time=%{time_total}\n' -X POST 'http://localhost:4566/_aws/execute-api/f28a2ed651/local/transitions/present-to-client' ...
http_status=401 total_time=0.055244

$ rg 'Traffic shape|Run duration|Latency tolerance|Idle cost|1\.150339|0\.055244|locally modeled|Lambda|Fargate' docs/adr/0021-ecs-vs-lambda.md
Traffic shape: observed local traffic baseline is 0 invocations/hour when no advisor presents a cycle; main services run as ECS services with desired count 1 each and repeated health checks.
Run duration: local route sample completed in 1.150339 seconds and the following warm request in 0.055244 seconds; main services are long-running HTTP services.
Latency tolerance: local modeled cold-start route latency was 1.150339 seconds on floci, indicative only and not a production guarantee.
Idle cost: Lambda has no desired task count and is modeled as 0 running tasks when idle; main services intentionally keep one Core Case Service task and one Tax Engine task running locally.
Decision: Lambda for taxpulse-present-to-client; Fargate for the Core Case Service and Tax Engine.

$ npx prettier --check lambda/present-to-client/handler.ts lambda/present-to-client/function.json lambda/present-to-client/package.json lambda/present-to-client/package-lock.json apigw/http-api.json docs/adr/0021-ecs-vs-lambda.md prompt-journal/0029-lambda-api-gateway.md
Checking formatting...
All matched files use Prettier code style!
```

## AI Review Evidence

Codex review output:

```text
Rubric result: Pass.

- Lambda runtime: function.json and floci readback both show nodejs24.x, arm64, handler.handler, and the Powertools layer. Handler setup lives outside the handler in createPresentToClientForwarder and warm logs reuse the same initId across two invocations.
- Logging: handler uses Powertools Logger, adds Lambda context, sets a correlation ID from event headers/requestContext, and emits structured JSON logs. No console.log is used.
- API Gateway: checked-in apigw/http-api.json and floci readback both show an HTTP API, one POST /transitions/present-to-client route, and AWS_PROXY payload format 2.0 integration to the Lambda.
- ADR: ADR-0021 decides per workload and cites measured traffic shape, run duration, latency tolerance, and idle cost. The cold-start figure is labelled as locally modeled on floci and indicative only.
```

What it missed:

```text
The first implementation pass was too broad: it added the API route and ADR before Task 1
asked for them, and temporarily removed the Lambda package manifest/lockfile. The final
diff restores the package files and keeps the later Task 2 and Task 3 artifacts only after
they were explicitly requested.
```

## AI-Tool Reflection

I accepted Codex's suggestion to use a module-scope forwarder with an `initId` because the
two-invocation floci logs prove warm reuse without relying on hidden mutable handler state.
I rejected the earlier over-broad suggestion to complete the HTTP API and ADR work during
Task 1, because the requested pass signal at that point was only the Lambda workload; Task 2
and Task 3 were added only after they were explicitly requested. I also kept the HTTP API
as `protocolType: HTTP` with `AWS_PROXY` and did not add REST-only features such as API keys,
usage plans, or request transformation.

## PR Routing

- Branch: `m7d4-implementation`
- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli`.

## AI Code-Review Checklist

- [x] Stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [x] Workflow changes keep stage transitions gated by role and current stage.
- [x] Typed boundaries are preserved with TypeScript interfaces and proxy-event parsing.
- [x] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [x] Tests or documented verification cover the changed behavior, including relevant negative paths.
- [x] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [x] ADR linked if this PR changes or implements an architectural decision.

## Deliverables Checklist

- [x] PR description includes verification output as a code block.
- [x] Verification output includes the two-invocation warm-reuse check.
- [x] Verification output includes a structured log line carrying the correlation ID.
- [x] Verification output includes the arm64 Node 24 function configuration.
- [x] Verification output includes the route invoking the Lambda through floci.
- [x] Verification output includes the ADR-0021 read showing each criterion's measurement.
- [x] AI-tool reflection names one accepted suggestion and why.
- [x] AI-tool reflection names one rejected suggestion and why.
- [x] Deliverables checklist is included at the bottom of the PR description.
- [x] Branch is `m7d4-implementation`.
- [x] PR is self-assigned in Assignees.
- [x] `Isaiah Muli` is requested under Reviewers.
