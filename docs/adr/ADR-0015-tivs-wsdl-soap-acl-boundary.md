# ADR-0015 - TIVS WSDL Contract and SOAP ACL Boundary

- Status: Accepted

## Context

TaxPulse must integrate with the brownfield Federal Taxpayer Identification Verification Service (TIVS), a legacy SOAP service whose WSDL is the authoritative contract. There is no MCP server and no available expert for this integration, so the WSDL was read directly from the EM-shared hosted source into a temporary local copy outside the repository.

The verification approach was summarize-then-confirm: every operation, message type, element shape, and declared fault below was checked against the WSDL source, not accepted from an AI paraphrase. Source line references are from the line-numbered temporary WSDL fetched for this review.

## Decision

Wrap TIVS behind the `services/tivs-acl` anti-corruption layer. The ACL translates SOAP request/response/fault shapes into TaxPulse-owned DTOs and domain errors. No SOAP-generated type, SOAP element name, or legacy fault object may cross into the Core Case Service or any capstone-facing signature.

## Verified Contract

| Operation | PortType declaration | Input message | Input element fields | Output message | Output element fields | Declared fault |
| --- | --- | --- | --- | --- | --- | --- |
| `VerifyTaxpayer` | `wsdl:operation name="VerifyTaxpayer"` with input and output only, lines 121-124 | `tns:VerifyTaxpayerRequest`, lines 103-105 | `tns:VerifyTaxpayer` element with `TIN: xsd:string`, `TINType: tns:TINTypeCode`, `LegalName: xsd:string`, lines 51-59 | `tns:VerifyTaxpayerResponse`, lines 106-108 | `tns:VerifyTaxpayerResponse` element with `MatchCode: tns:MatchCodeType`, optional `VerifiedName: xsd:string`, `TINType: tns:TINTypeCode`, lines 60-68 | None. The `VerifyTaxpayer` portType operation has no `wsdl:fault` child at lines 121-124. |
| `GetTaxpayerStatus` | `wsdl:operation name="GetTaxpayerStatus"` with input, output, and fault, lines 126-130 | `tns:GetTaxpayerStatusRequest`, lines 109-111 | `tns:GetTaxpayerStatus` element with `TIN: xsd:string`, `TINType: tns:TINTypeCode`, lines 71-78 | `tns:GetTaxpayerStatusResponse`, lines 112-114 | `tns:GetTaxpayerStatusResponse` element with `Standing: tns:StandingCode`, `AsOfDate: xsd:string`, lines 79-87 | `TaxpayerNotFoundFault`, declared on the portType operation as `message="tns:TaxpayerNotFoundFault"`, line 129. |

The WSDL message declarations confirm the operation messages map to wrapper elements:

| Message | Part | Element declaration verified |
| --- | --- | --- |
| `VerifyTaxpayerRequest` | `parameters` | `tns:VerifyTaxpayer`, lines 103-105; element body at lines 51-59 |
| `VerifyTaxpayerResponse` | `parameters` | `tns:VerifyTaxpayerResponse`, lines 106-108; element body at lines 60-68 |
| `GetTaxpayerStatusRequest` | `parameters` | `tns:GetTaxpayerStatus`, lines 109-111; element body at lines 71-78 |
| `GetTaxpayerStatusResponse` | `parameters` | `tns:GetTaxpayerStatusResponse`, lines 112-114; element body at lines 79-87 |
| `TaxpayerNotFoundFault` | `fault` | `tns:TaxpayerNotFoundFault`, lines 115-117; element body at lines 90-98 |

The declared fault is first-class. `TaxpayerNotFoundFault` is both a message with a `fault` part at lines 115-117 and an element with structured fields `FaultCode`, `FaultReason`, and `TIN` at lines 90-98. `GetTaxpayerStatus` references that fault from the abstract `portType` at line 129 and from the concrete binding at lines 144-146. `VerifyTaxpayer` declares no fault in its `portType` operation at lines 121-124.

## Brownfield Smells the ACL Absorbs

- `MatchCode` is a numeric string simple type, not a boolean and not a TaxPulse enum. The WSDL defines `MatchCodeType` as `xsd:string` with values `"0"`, `"1"`, `"2"`, and `"3"` at lines 31-40. The source comments define `"0"` as match, `"1"` as TIN not issued, `"2"` as TIN not found, and `"3"` as TIN/name mismatch at lines 31-32.
- `AsOfDate` is an `xsd:string` that carries an MMDDYYYY legacy date, not an ISO date or date-time. The WSDL calls this out immediately before the `AsOfDate` element at lines 82-84.
- Unknown TIN handling is inconsistent by operation. `VerifyTaxpayer` returns `MatchCode` `"2"` for unknown TINs and declares no fault, while `GetTaxpayerStatus` declares `TaxpayerNotFoundFault` for unknown TINs at lines 120-130.

## Verification Trail

| Claim checked | Source checked | Result |
| --- | --- | --- |
| The service exposes `VerifyTaxpayer` and `GetTaxpayerStatus`. | `wsdl:portType name="TIVSPortType"` at lines 119-131. | Confirmed. No additional operations were present in the portType. |
| `VerifyTaxpayer` takes `TIN`, `TINType`, and `LegalName`. | `VerifyTaxpayerRequest` message at lines 103-105 and `VerifyTaxpayer` element at lines 51-59. | Confirmed. |
| `VerifyTaxpayer` returns `MatchCode`, optional `VerifiedName`, and `TINType`. | `VerifyTaxpayerResponse` message at lines 106-108 and response element at lines 60-68. | Confirmed. `VerifiedName` is optional via `minOccurs="0"`. |
| `VerifyTaxpayer` declares no fault. | `VerifyTaxpayer` portType operation at lines 121-124. | Confirmed first because no-fault claims are high risk. The operation has input and output only. |
| `GetTaxpayerStatus` takes `TIN` and `TINType`. | `GetTaxpayerStatusRequest` message at lines 109-111 and element at lines 71-78. | Confirmed. |
| `GetTaxpayerStatus` returns `Standing` and `AsOfDate`. | `GetTaxpayerStatusResponse` message at lines 112-114 and element at lines 79-87. | Confirmed. A prior working assumption that the response field was named `Status` was wrong; the WSDL names it `Standing`. |
| `GetTaxpayerStatus` declares `TaxpayerNotFoundFault`. | `GetTaxpayerStatus` portType fault at line 129, fault message at lines 115-117, and fault element at lines 90-98. | Confirmed. The binding also carries the SOAP fault at lines 144-146. |
| The binding is SOAP document/literal. | `soap:binding style="document"` at line 134 and `soap:body use="literal"` at lines 137-138 and 142-143. | Confirmed. |

## Consequences

- The ACL must map legacy `MatchCodeType` string values into TaxPulse-owned verification outcomes.
- The ACL must parse or preserve `AsOfDate` deliberately instead of treating it as an ISO date.
- The ACL must normalize unknown-TIN behavior across the two operations: code `"2"` from `VerifyTaxpayer` and `TaxpayerNotFoundFault` from `GetTaxpayerStatus` are the same domain condition expressed differently by the legacy service.
- Tests must fail if SOAP-shaped names or types leak into capstone-facing DTOs or REST signatures.
- Audit logging must redact taxpayer identifiers to last four and must not persist raw TIN, SSN, or EIN values.

## Alternatives Considered

- **Expose SOAP response objects directly to the Core Case Service**: Rejected because it lets legacy names, numeric strings, and fault shapes become TaxPulse domain concepts.
- **Model `MatchCode` as a boolean match flag only**: Rejected because codes `"1"`, `"2"`, and `"3"` are distinct legacy outcomes that must be mapped intentionally.
- **Treat `GetTaxpayerStatus` unknown TIN as just another status response**: Rejected because the WSDL declares a first-class `TaxpayerNotFoundFault`; swallowing it would hide a published error contract.
