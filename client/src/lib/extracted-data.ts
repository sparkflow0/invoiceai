import type { ExtractedData } from "@shared/schema";

export const formatFieldValue = (
  value: ExtractedData["fields"][number]["value"] | undefined,
) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

export const getLineItemColumns = (
  lineItems: NonNullable<ExtractedData["lineItems"]>,
) => {
  const columns: string[] = [];
  for (const item of lineItems) {
    for (const key of Object.keys(item)) {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    }
  }
  return columns;
};

export const buildRowsFromExtractedData = (data: ExtractedData) => {
  const rows: string[][] = [["Field", "Value"]];
  const fields = Array.isArray(data.fields) ? data.fields : [];
  rows.push(
    ...fields.map((field) => [field.label, formatFieldValue(field.value)]),
  );

  if (data.lineItems && data.lineItems.length > 0) {
    const columns = getLineItemColumns(data.lineItems);
    rows.push(["", ""]);
    rows.push(["Line Items", ""]);
    rows.push(columns);
    for (const item of data.lineItems) {
      rows.push(columns.map((column) => formatFieldValue(item[column] ?? null)));
    }
  }

  return rows;
};

export const buildDelimitedContent = (rows: string[][], delimiter: string) =>
  rows.map((row) => row.join(delimiter)).join("\n");
