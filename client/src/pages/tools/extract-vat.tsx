import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calculator,
  FileSpreadsheet,
  Upload,
  CheckCircle,
  ArrowRight,
  Zap,
  Shield,
  Receipt,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const useCases = [
  {
    title: "VAT Reclaim",
    description: "Extract VAT amounts from invoices for accurate input tax reclaim and reporting.",
  },
  {
    title: "Tax Compliance",
    description: "Ensure accurate VAT data for quarterly or annual tax filings and audits.",
  },
  {
    title: "International Invoices",
    description: "Handle invoices with multiple tax rates and currencies from global vendors.",
  },
  {
    title: "Bookkeeping",
    description: "Automatically separate net amounts from VAT for clean accounting records.",
  },
];

const faqs = [
  {
    question: "What VAT/tax information is extracted?",
    answer: "We extract the total VAT amount, VAT rate percentage when displayed, net amount, and gross amount. For invoices with multiple tax rates, each is extracted separately.",
  },
  {
    question: "Do you support different VAT rates?",
    answer: "Yes, our AI recognizes various VAT rates (0%, 5%, 10%, 20%, etc.) and extracts them accurately regardless of the percentage or country format.",
  },
  {
    question: "Can you extract VAT from international invoices?",
    answer: "Absolutely. We support invoices in multiple languages and formats, handling European VAT, US sales tax, GST, and other tax systems.",
  },
  {
    question: "How accurate is the VAT extraction?",
    answer: "VAT extraction achieves over 95% accuracy on clear invoices. All extracted values are editable so you can verify and correct before export.",
  },
  {
    question: "Is extracted VAT data suitable for tax filing?",
    answer: "The extracted data provides a solid starting point for tax preparation. We recommend verifying figures before official filing as with any automated tool.",
  },
];

export default function ExtractVat() {
  return (
    <div className="py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 text-4xl font-bold md:text-5xl" data-testid="text-tool-title">
            Extract VAT from Invoice
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Automatically extract VAT and tax amounts from invoices with AI precision. 
            Get accurate tax data for compliance, reclaim, and bookkeeping in seconds.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="gap-2 px-8" data-testid="button-tool-upload">
              <Link href="/app">
                <Upload className="h-5 w-5" />
                Upload Invoice
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
                <Receipt className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Multi-Rate Support</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Handles multiple VAT rates on single invoices
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="p-0 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Tax Compliance Ready</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Data formatted for tax reporting needs
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="p-0 text-center">
                <Zap className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Instant Extraction</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Get VAT data in seconds, not hours
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
              How VAT Extraction Works
            </h2>
            <div className="mt-12 flex flex-col items-center gap-8 md:flex-row md:justify-center">
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">Upload Invoice</p>
              </div>
              <ArrowRight className="hidden h-6 w-6 text-muted-foreground md:block" />
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Calculator className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">AI Finds VAT</p>
              </div>
              <ArrowRight className="hidden h-6 w-6 text-muted-foreground md:block" />
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">Export Data</p>
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
              Extract VAT Now
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
