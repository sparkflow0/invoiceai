export function calculateRiskScore(extractedFields: any[], lineItems: any[]) {
    let riskScore = 0;
    const flags: string[] = [];

    const vendorField = extractedFields.find((f: any) =>
        f.label.toLowerCase().includes("vendor") || f.label.toLowerCase().includes("from")
    );
    if (!vendorField || !vendorField.value) {
        riskScore += 30;
        flags.push("MISSING_VENDOR");
    }

    const totalField = extractedFields.find((f: any) => f.label.toLowerCase().includes("total"));
    const totalValue = totalField ? parseFloat(totalField.value) : 0;

    if (lineItems && lineItems.length > 0) {
        const sumLines = lineItems.reduce((acc: number, item: any) => acc + (parseFloat(item.Total) || 0), 0);
        if (Math.abs(sumLines - totalValue) > 0.01) {
            riskScore += 40;
            flags.push("TOTAL_MISMATCH");
        }
    }

    return { riskScore, flags };
}

// calculateRiskScore logic preserved.
