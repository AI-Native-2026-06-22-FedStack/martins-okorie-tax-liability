import soap from "soap";

type TINType = "EIN" | "SSN";

interface GeneratedTivsClient {
  setEndpoint(endpointUrl: string): void;
  setSecurity(security: unknown): void;
  VerifyTaxpayerAsync(args: {
    TIN: string;
    TINType: TINType;
    LegalName: string;
  }): Promise<[unknown]>;
  GetTaxpayerStatusAsync(args: { TIN: string; TINType: TINType }): Promise<[unknown]>;
}

export interface TivsClient {
  verifyTaxpayer(TIN: string, TINType: TINType, LegalName: string): Promise<unknown>;
  getTaxpayerStatus(TIN: string, TINType: TINType): Promise<unknown>;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export async function createTivsClient(): Promise<TivsClient> {
  const client = (await soap.createClientAsync(requiredEnv("TIVS_WSDL_URL"))) as unknown as GeneratedTivsClient;

  client.setEndpoint(requiredEnv("TIVS_ENDPOINT_URL"));
  client.setSecurity(new soap.WSSecurity(requiredEnv("TIVS_USERNAME"), requiredEnv("TIVS_PASSWORD")));

  return {
    async verifyTaxpayer(TIN, TINType, LegalName) {
      const [response] = await client.VerifyTaxpayerAsync({ TIN, TINType, LegalName });
      return response;
    },

    async getTaxpayerStatus(TIN, TINType) {
      const [response] = await client.GetTaxpayerStatusAsync({ TIN, TINType });
      return response;
    },
  };
}
