import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColumnDef, DataTable } from "../components/DataTable";

type FilingItem = {
  id: string;
  client: string;
  amount: number;
};

type PaymentItem = {
  paymentId: string;
  method: string;
  status: string;
};

describe("Generic DataTable<T> Component", () => {
  it("renders type-safe table rows for FilingItem row type", () => {
    const filings: FilingItem[] = [
      { id: "F1", client: "Acme Corp", amount: 12000 },
      { id: "F2", client: "Beta LLC", amount: 8500 },
    ];

    const columns: ColumnDef<FilingItem>[] = [
      { key: "id", header: "Filing ID", render: (item) => item.id },
      { key: "client", header: "Client Name", render: (item) => item.client },
      { key: "amount", header: "Tax Amount", render: (item) => `$${item.amount}` },
    ];

    render(
      <DataTable
        data={filings}
        columns={columns}
        keyExtractor={(item) => item.id}
        ariaLabel="Filings Table"
      />
    );

    expect(screen.getByRole("table", { name: "Filings Table" })).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta LLC")).toBeInTheDocument();
    expect(screen.getByText("$12000")).toBeInTheDocument();
  });

  it("renders type-safe table rows for PaymentItem row type (second distinct row type)", () => {
    const payments: PaymentItem[] = [
      { paymentId: "P-100", method: "ACH Direct", status: "Cleared" },
      { paymentId: "P-101", method: "Wire Transfer", status: "Pending" },
    ];

    const columns: ColumnDef<PaymentItem>[] = [
      { key: "paymentId", header: "Payment Ref", render: (item) => item.paymentId },
      { key: "method", header: "Method", render: (item) => item.method },
      { key: "status", header: "Status", render: (item) => item.status },
    ];

    render(
      <DataTable
        data={payments}
        columns={columns}
        keyExtractor={(item) => item.paymentId}
        ariaLabel="Payments Table"
      />
    );

    expect(screen.getByRole("table", { name: "Payments Table" })).toBeInTheDocument();
    expect(screen.getByText("ACH Direct")).toBeInTheDocument();
    expect(screen.getByText("Cleared")).toBeInTheDocument();
    expect(screen.getByText("Wire Transfer")).toBeInTheDocument();
  });

  it("renders empty message when data array is empty", () => {
    render(
      <DataTable<FilingItem>
        data={[]}
        columns={[{ key: "id", header: "ID", render: (i) => i.id }]}
        keyExtractor={(i) => i.id}
        emptyMessage="No filings available"
      />
    );

    expect(screen.getByText("No filings available")).toBeInTheDocument();
  });
});
