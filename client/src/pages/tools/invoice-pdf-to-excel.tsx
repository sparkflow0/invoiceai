import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  FileSpreadsheet,
  Upload,
  CheckCircle,
  ArrowRight,
  Zap,
  Shield,
  Clock,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageMeta } from "@/components/seo/page-meta";
import { FaqSchema } from "@/components/seo/faq-schema";

const metaDescription =
  "Convert invoice PDFs to Excel in seconds. Extract vendor, totals, VAT, and line items with AI.";

const useCases = [
  {
    title: "Accounts Payable",
    description: "Extract vendor invoices into Excel for payment processing and approval workflows.",
  },
  {
    title: "Expense Reporting",
    description: "Convert expense receipts and invoices into structured spreadsheets for reimbursement.",
  },
  {
    title: "Financial Audits",
    description: "Digitize paper invoices for audit documentation and compliance records.",
  },
  {
    title: "Tax Preparation",
    description: "Organize invoice data for accurate tax filing and VAT calculations.",
  },
];

const faqs = [
  {
    question: "What types of PDF invoices can be processed?",
    answer: "Our AI handles virtually all PDF invoice formats including digital PDFs, scanned documents, and even low-quality scans. We support invoices from any vendor or country.",
  },
  {
    question: "What data is extracted from invoices?",
    answer: "We extract vendor name, invoice number, date, total amount, VAT/tax amounts, currency, and individual line items including descriptions, quantities, and prices.",
  },
  {
    question: "How accurate is the PDF to Excel conversion?",
    answer: "Our AI achieves over 95% accuracy on standard invoice formats. You can review and edit all extracted data before exporting to ensure 100% accuracy.",
  },
  {
    question: "Is my invoice data secure?",
    answer: "Absolutely. All files are encrypted during upload and processing. PDFs are automatically deleted immediately after conversion. We never store your documents.",
  },
  {
    question: "What Excel format do you export?",
    answer: "We export to standard .xlsx format compatible with Microsoft Excel, Google Sheets, and other spreadsheet applications. CSV export is also available.",
  },
];

export default function InvoicePdfToExcel() {
  return (
    <div className="py-20 md:py-32">
      <PageMeta
        title="Invoice PDF to Excel Converter | InvoiceAI"
        description={metaDescription}
      />
      <FaqSchema faqs={faqs} />
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 text-4xl font-bold md:text-5xl" data-testid="text-tool-title">
            Invoice PDF to Excel Converter
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Convert invoice PDFs to structured Excel spreadsheets in seconds. 
            AI-powered extraction captures vendor details, amounts, dates, 
            and line items with high accuracy.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="gap-2 px-8" data-testid="button-tool-upload">
              <Link href="/app">
                <Upload className="h-5 w-5" />
                Upload Invoice PDF
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="gap-2" data-testid="button-tool-sample">
              <Link href="/app?sample=true">
                Try with Sample
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <section className="mt-24">
          <div className="grid gap-8 md:grid-cols-3">
            <Card className="p-6">
              <CardContent className="p-0 text-center">
                <Zap className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Instant Conversion</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Convert PDF invoices to Excel in under 10 seconds
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="p-0 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">95%+ Accuracy</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  AI-powered extraction with editable results
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="p-0 text-center">
                <Shield className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Secure Processing</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Files encrypted and auto-deleted after use
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-center text-3xl font-semibold" data-testid="text-use-cases-title">
            Use Cases
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {useCases.map((useCase) => (
              <Card key={useCase.title} className="p-6">
                <CardContent className="p-0">
                  <h3 className="font-semibold">{useCase.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {useCase.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-32">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold" data-testid="text-how-title">
              How PDF to Excel Conversion Works
            </h2>
            <div className="mt-12 flex flex-col items-center gap-8 md:flex-row md:justify-center">
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">Upload PDF</p>
              </div>
              <ArrowRight className="hidden h-6 w-6 text-muted-foreground md:block" />
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">AI Extracts Data</p>
              </div>
              <ArrowRight className="hidden h-6 w-6 text-muted-foreground md:block" />
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">Download Excel</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-32">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-semibold" data-testid="text-faq-title">
              Frequently Asked Questions
            </h2>
            <Accordion type="single" collapsible className="mt-12">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left" data-testid={`accordion-faq-${index}`}>
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="mt-32 text-center">
          <Button size="lg" asChild className="gap-2 px-8" data-testid="button-tool-cta">
            <Link href="/app">
              <Upload className="h-5 w-5" />
              Convert Invoice PDF to Excel
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
