import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Brain,
  FileSpreadsheet,
  Upload,
  CheckCircle,
  ArrowRight,
  Zap,
  Shield,
  Layers,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const useCases = [
  {
    title: "Automated Data Entry",
    description: "Eliminate manual typing by letting AI extract and structure invoice data automatically.",
  },
  {
    title: "Document Digitization",
    description: "Convert paper archives and scanned documents into searchable, structured data.",
  },
  {
    title: "ERP Integration Prep",
    description: "Extract clean data ready for import into your accounting or ERP system.",
  },
  {
    title: "Financial Analysis",
    description: "Aggregate invoice data for spend analysis, vendor tracking, and reporting.",
  },
];

const features = [
  {
    title: "Multi-field Extraction",
    description: "Captures vendor name, invoice number, date, amounts, VAT, currency, and line items.",
  },
  {
    title: "Layout Agnostic",
    description: "Works with any invoice format or layout without templates or configuration.",
  },
  {
    title: "Editable Results",
    description: "Review and correct any extracted field before exporting to ensure accuracy.",
  },
  {
    title: "Multiple Export Formats",
    description: "Export to Excel, CSV, or copy structured data directly to your clipboard.",
  },
];

const faqs = [
  {
    question: "What is AI invoice data extraction?",
    answer: "AI data extraction uses machine learning to automatically read and understand invoice documents, identifying and extracting key information like vendor names, amounts, dates, and line items without manual input.",
  },
  {
    question: "How does AI understand different invoice formats?",
    answer: "Our AI is trained on millions of invoice samples from around the world. It learns the patterns and layouts of invoices to understand where data appears regardless of the specific format.",
  },
  {
    question: "What makes AI extraction better than templates?",
    answer: "Template-based systems require manual setup for each vendor format. AI extraction works automatically with any layout, saving hours of configuration and maintenance.",
  },
  {
    question: "Can I process multiple invoices at once?",
    answer: "The free plan processes one invoice at a time. Our Pro plan includes bulk upload support for processing multiple documents in a single batch.",
  },
  {
    question: "What happens if the AI makes a mistake?",
    answer: "All extracted data is fully editable before export. You can review each field and make corrections as needed to ensure 100% accuracy in your final data.",
  },
];

export default function DataExtraction() {
  return (
    <div className="py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 text-4xl font-bold md:text-5xl" data-testid="text-tool-title">
            Invoice Data Extraction AI
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Advanced AI-powered extraction that understands any invoice format. 
            Get structured data from PDFs and images without templates, 
            configuration, or manual work.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="gap-2 px-8" data-testid="button-tool-upload">
              <Link href="/app">
                <Upload className="h-5 w-5" />
                Extract Data Now
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
                <Brain className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Advanced AI</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Trained on millions of invoice samples
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="p-0 text-center">
                <Layers className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Any Format</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  No templates or configuration needed
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="p-0 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">High Accuracy</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  95%+ field-level accuracy
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-center text-3xl font-semibold" data-testid="text-features-title">
            AI Extraction Features
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6">
                <CardContent className="p-0">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
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
              How AI Data Extraction Works
            </h2>
            <div className="mt-12 flex flex-col items-center gap-8 md:flex-row md:justify-center">
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">Upload Document</p>
              </div>
              <ArrowRight className="hidden h-6 w-6 text-muted-foreground md:block" />
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">AI Analyzes</p>
              </div>
              <ArrowRight className="hidden h-6 w-6 text-muted-foreground md:block" />
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">Get Structured Data</p>
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
              Start Extracting Data
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
