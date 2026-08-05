import soap from "soap";
import {
  TaxpayerStatus,
  TaxpayerStatusRequest,
  TaxpayerVerification,
  TaxpayerVerificationRequest,
} from "../acl/dto.js";
import { translateSoapFault, translateTaxpayerStatus, translateVerification } from "../acl/translate.js";

interface TivsSoapClient extends soap.Client {
  VerifyTaxpayerAsync(args: {
    TIN: string;
    TINType: string;
    LegalName: string;
  }): Promise<[unknown]>;
  GetTaxpayerStatusAsync(args: { TIN: string; TINType: string }): Promise<[unknown]>;
}

export interface TivsClient {
  verifyTaxpayer(request: TaxpayerVerificationRequest): Promise<TaxpayerVerification>;
  getTaxpayerStatus(request: TaxpayerStatusRequest): Promise<TaxpayerStatus>;
}

export interface TivsClientConfig {
  wsdlUrl: string;
  endpointUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
}

export async function createTivsClient(config: TivsClientConfig): Promise<TivsClient> {
  const client = (await soap.createClientAsync(config.wsdlUrl)) as TivsSoapClient;

  client.setEndpoint(config.endpointUrl);
  client.setSecurity(new soap.WSSecurity(config.username, config.password));

  return {
    async verifyTaxpayer(request) {
      try {
        const [response] = await client.VerifyTaxpayerAsync({
          TIN: request.taxpayerId,
          TINType: request.taxpayerIdType,
          LegalName: request.legalName,
        });

        return translateVerification(response as { MatchCode?: string | number; TINType?: string; VerifiedName?: string });
      } catch (error) {
        throw translateSoapFault(error);
      }
    },

    async getTaxpayerStatus(request) {
      try {
        const [response] = await client.GetTaxpayerStatusAsync({
          TIN: request.taxpayerId,
          TINType: request.taxpayerIdType,
        });

        return translateTaxpayerStatus(response as { Standing?: string; AsOfDate?: string });
      } catch (error) {
        throw translateSoapFault(error);
      }
    },
  };
}
