import express, { Request, Response } from "express";
import { createTivsBreaker } from "./breaker.js";
import {
  TaxpayerNotFoundError,
  TaxpayerStatusRequest,
  TaxpayerVerificationRequest,
  TivsAuthenticationError,
} from "./acl/dto.js";
import { renderAuditLine } from "./audit.js";
import { createTivsClient } from "./soap/tivsClient.js";
import { translateSoapFault, translateTaxpayerStatus, translateVerification } from "./acl/translate.js";

export async function createApp() {
  const client = await createTivsClient();

  const verifyBreaker = createTivsBreaker(async (request: TaxpayerVerificationRequest) => {
    try {
      const response = await client.verifyTaxpayer(
        request.taxpayerId,
        request.taxpayerIdType,
        request.legalName,
      );
      return translateVerification(response);
    } catch (error) {
      throw translateSoapFault(error);
    }
  });
  const statusBreaker = createTivsBreaker(async (request: TaxpayerStatusRequest) => {
    try {
      const response = await client.getTaxpayerStatus(request.taxpayerId, request.taxpayerIdType);
      return translateTaxpayerStatus(response);
    } catch (error) {
      throw translateSoapFault(error);
    }
  });
  const app = express();

  app.use(express.json());

  app.post("/v1/taxpayer-verifications", async (req: Request, res: Response) => {
    const request = req.body as TaxpayerVerificationRequest;

    try {
      const result = await verifyBreaker.fire(request);
      console.info(
        JSON.stringify(
          renderAuditLine({
            event: "tivs_acl_call",
            operation: "VerifyTaxpayer",
            outcome: "success",
            request: request as unknown as Record<string, string>,
            timestamp: new Date().toISOString(),
          }),
        ),
      );
      res.status(200).json(result);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.post("/v1/taxpayer-status", async (req: Request, res: Response) => {
    const request = req.body as TaxpayerStatusRequest;

    try {
      const result = await statusBreaker.fire(request);
      console.info(
        JSON.stringify(
          renderAuditLine({
            event: "tivs_acl_call",
            operation: "GetTaxpayerStatus",
            outcome: "success",
            request: request as unknown as Record<string, string>,
            timestamp: new Date().toISOString(),
          }),
        ),
      );
      res.status(200).json(result);
    } catch (error) {
      handleError(error, res);
    }
  });

  return app;
}

function handleError(error: unknown, res: Response) {
  if (error instanceof TaxpayerNotFoundError) {
    res.status(404).json({ code: "taxpayer_not_found", message: error.message });
    return;
  }

  if (error instanceof TivsAuthenticationError) {
    res.status(502).json({ code: "tivs_authentication_failed", message: error.message });
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
