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

// Simple test runner
if (require.main === module) {
    const tests = [
        {
            name: "Happy Path - Low Risk",
            fields: [{ label: "Vendor", value: "ACME Corp" }, { label: "Total", value: "100.00" }],
            lineItems: [{ Total: "100.00" }],
            expectedRisk: 0,
        },
        {
            name: "Missing Vendor",
            fields: [{ label: "Total", value: "100.00" }],
            lineItems: [{ Total: "100.00" }],
            expectedRisk: 30,
        },
        {
            name: "Total Mismatch",
            fields: [{ label: "Vendor", value: "ACME" }, { label: "Total", value: "100.00" }],
            lineItems: [{ Total: "90.00" }],
            expectedRisk: 40,
        },
        {
            name: "Both Issues",
            fields: [{ label: "Total", value: "100.00" }],
            lineItems: [{ Total: "90.00" }],
            expectedRisk: 70,
        }
    ];

    tests.forEach(t => {
        const result = calculateRiskScore(t.fields, t.lineItems);
        if (result.riskScore === t.expectedRisk) {
            console.log(`✅ ${t.name} passed`);
        } else {
            console.error(`❌ ${t.name} failed: expected ${t.expectedRisk}, got ${result.riskScore}`);
        }
    });
}
