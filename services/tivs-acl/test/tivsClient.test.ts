import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const soapMocks = vi.hoisted(() => {
  const generatedClient = {
    GetTaxpayerStatusAsync: vi.fn(),
    VerifyTaxpayerAsync: vi.fn(),
    setEndpoint: vi.fn(),
    setSecurity: vi.fn(),
  };

  return {
    createClientAsync: vi.fn(async () => generatedClient),
    generatedClient,
    WSSecurity: vi.fn(function WSSecurity(this: { username: string; password: string }, username, password) {
      this.username = username;
      this.password = password;
    }),
  };
});

vi.mock("soap", () => ({
  default: {
    createClientAsync: soapMocks.createClientAsync,
    WSSecurity: soapMocks.WSSecurity,
  },
}));

describe("TIVS SOAP client", () => {
  beforeEach(() => {
    process.env.TIVS_WSDL_URL = "configured-wsdl-url";
    process.env.TIVS_ENDPOINT_URL = "configured-endpoint-url";
    process.env.TIVS_USERNAME = "configured-username";
    process.env.TIVS_PASSWORD = "configured-password";

    soapMocks.generatedClient.VerifyTaxpayerAsync.mockResolvedValue([
      { MatchCode: "0", TINType: "EIN", VerifiedName: "SYNTHETIC TAXPAYER LLC" },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.TIVS_WSDL_URL;
    delete process.env.TIVS_ENDPOINT_URL;
    delete process.env.TIVS_USERNAME;
    delete process.env.TIVS_PASSWORD;
  });

  it("builds from TIVS_WSDL_URL and calls VerifyTaxpayerAsync through the narrow interface", async () => {
    const { createTivsClient } = await import("../src/soap/tivsClient.js");

    const client = await createTivsClient();
    const response = await client.verifyTaxpayer("000000000", "EIN", "SYNTHETIC TAXPAYER LLC");

    expect(soapMocks.createClientAsync).toHaveBeenCalledWith("configured-wsdl-url");
    expect(soapMocks.generatedClient.setEndpoint).toHaveBeenCalledWith("configured-endpoint-url");
    expect(soapMocks.generatedClient.setSecurity).toHaveBeenCalledWith(expect.any(soapMocks.WSSecurity));
    expect(soapMocks.generatedClient.VerifyTaxpayerAsync).toHaveBeenCalledWith({
      TIN: "000000000",
      TINType: "EIN",
      LegalName: "SYNTHETIC TAXPAYER LLC",
    });
    expect(response).toEqual({
      matched: true,
      decision: "matched",
      verifiedLegalName: "SYNTHETIC TAXPAYER LLC",
    });
  });

  it("exports only the narrow interface factory at runtime", async () => {
    const moduleExports = await import("../src/soap/tivsClient.js");

    expect(Object.keys(moduleExports)).toEqual(["createTivsClient"]);
  });
});
