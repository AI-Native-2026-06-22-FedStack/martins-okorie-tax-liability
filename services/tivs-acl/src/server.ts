import express, { Request, Response } from "express";
import { createTivsBreaker } from "./breaker.js";
import {
  TaxpayerIdentifierNotFoundError,
  TaxpayerStatusRequest,
  TaxpayerVerificationRequest,
  TivsAuthenticationError,
  TivsDomainError,
} from "./acl/dto.js";
import { renderAuditLine, type TivsAuditLine } from "./audit.js";
import { createTivsClient, type TivsClient } from "./soap/tivsClient.js";

export type AuditSink = (line: TivsAuditLine) => void;

export interface TivsAclAppOptions {
  client?: TivsClient;
  auditSink?: AuditSink;
}

const defaultAuditSink: AuditSink = (line) => {
  console.info(JSON.stringify(line));
};

export async function createApp(options: TivsAclAppOptions = {}) {
  const client = options.client ?? (await createTivsClient());
  const auditSink = options.auditSink ?? defaultAuditSink;

  const verifyBreaker = createTivsBreaker(async (request: TaxpayerVerificationRequest) => {
    return client.verifyTaxpayer(request.taxpayerId, request.taxpayerIdType, request.legalName);
  });
  const statusBreaker = createTivsBreaker(async (request: TaxpayerStatusRequest) => {
    return client.getTaxpayerStatus(request.taxpayerId, request.taxpayerIdType);
  });
  const app = express();

  app.use(express.json());

  app.post("/v1/taxpayer-verifications", async (req: Request, res: Response) => {
    const request = req.body as TaxpayerVerificationRequest;
    await auditedCall({
      auditSink,
      correlationId: correlationId(req),
      operation: "VerifyTaxpayer",
      request: request as unknown as Record<string, string>,
      res,
      run: () => verifyBreaker.fire(request),
    });
  });

  app.post("/v1/taxpayer-status", async (req: Request, res: Response) => {
    const request = req.body as TaxpayerStatusRequest;
    await auditedCall({
      auditSink,
      correlationId: correlationId(req),
      operation: "GetTaxpayerStatus",
      request: request as unknown as Record<string, string>,
      res,
      run: () => statusBreaker.fire(request),
    });
  });

  return app;
}

async function auditedCall<TResult>({
  auditSink,
  correlationId,
  operation,
  request,
  res,
  run,
}: {
  auditSink: AuditSink;
  correlationId: string;
  operation: TivsAuditLine["operation"];
  request: Record<string, string>;
  res: Response;
  run: () => Promise<TResult>;
}) {
  const startedAt = Date.now();

  try {
    const result = await run();
    auditSink(
      renderAuditLine({
        correlationId,
        durationMs: Date.now() - startedAt,
        event: "tivs_acl_call",
        operation,
        outcome: "success",
        request,
        timestamp: new Date().toISOString(),
      }),
    );
    res.status(200).json(result);
  } catch (error) {
    auditSink(
      renderAuditLine({
        correlationId,
        durationMs: Date.now() - startedAt,
        errorCode: error instanceof TivsDomainError ? error.code : "tivs_unavailable",
        event: "tivs_acl_call",
        operation,
        outcome: "error",
        request,
        timestamp: new Date().toISOString(),
      }),
    );
    handleError(error, res);
  }
}

function correlationId(req: Request): string {
  const header = req.get("x-correlation-id");
  return header && header.length > 0 ? header : "missing-correlation-id";
}

function handleError(error: unknown, res: Response) {
  if (error instanceof TaxpayerIdentifierNotFoundError) {
    res.status(404).json({ code: error.code, message: error.message });
    return;
  }

  if (error instanceof TivsAuthenticationError) {
    res.status(502).json({ code: error.code, message: error.message });
    return;
  }

  res.status(503).json({ code: "tivs_unavailable", message: "Taxpayer verification is unavailable." });
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.ACL_PORT ?? 4300);
  const app = await createApp();
  app.listen(port, () => {
    console.info(`TIVS ACL listening on port ${port}`);
  });
}
