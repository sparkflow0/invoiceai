import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Camera,
  FileSpreadsheet,
  Upload,
  CheckCircle,
  ArrowRight,
  Zap,
  Shield,
  Smartphone,
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
  "Convert receipt photos to Excel with AI. Extract merchant, date, totals, and taxes from JPG or PNG images.";

const useCases = [
  {
    title: "Expense Tracking",
    description: "Photograph receipts and instantly convert to spreadsheet format for expense reports.",
  },
  {
    title: "Business Expenses",
    description: "Capture vendor receipts on the go and export structured data for accounting.",
  },
  {
    title: "Tax Deductions",
    description: "Organize receipt images into clean Excel files for tax preparation and audits.",
  },
  {
    title: "Small Business Bookkeeping",
    description: "Digitize paper receipts without manual data entry for simplified bookkeeping.",
  },
];

const faqs = [
  {
    question: "What image formats are supported?",
    answer: "We support JPG and PNG images. You can upload photos taken with your phone camera, scanned receipts, or screenshots of digital receipts.",
  },
  {
    question: "Can I convert blurry or low-quality receipt photos?",
    answer: "Our AI is optimized for real-world conditions and can handle most phone photos. For best results, ensure the receipt is well-lit and in focus.",
  },
  {
    question: "What data is extracted from receipts?",
    answer: "We extract merchant name, date, total amount, tax amounts, and individual line items when visible. The AI adapts to various receipt layouts.",
  },
  {
    question: "How do I upload receipt images?",
    answer: "Simply drag and drop your image files into the upload area, or click to browse. You can also take photos directly on mobile devices.",
  },
  {
    question: "Is receipt data extraction accurate?",
    answer: "We achieve over 90% accuracy on clear receipt images. All data is editable before export so you can correct any extraction errors.",
  },
];

export default function ReceiptToExcel() {
  return (
    <div className="py-20 md:py-32">
      <PageMeta
        title="Receipt Image to Excel Converter | InvoiceAI"
        description={metaDescription}
      />
      <FaqSchema faqs={faqs} />
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 text-4xl font-bold md:text-5xl" data-testid="text-tool-title">
            Receipt Image to Excel Converter
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Convert receipt photos and images to structured Excel data instantly. 
            Snap a photo, upload, and get organized spreadsheet data ready for 
            expense reports and accounting.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="gap-2 px-8" data-testid="button-tool-upload">
              <Link href="/app">
                <Upload className="h-5 w-5" />
                Upload Receipt Image
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
                <Smartphone className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Phone Photos Welcome</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Works with photos from any smartphone camera
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="p-0 text-center">
                <Zap className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Smart OCR</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  AI reads any receipt layout automatically
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="p-0 text-center">
                <Shield className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Private & Secure</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Images deleted after processing
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
              How Receipt to Excel Works
            </h2>
            <div className="mt-12 flex flex-col items-center gap-8 md:flex-row md:justify-center">
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Camera className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">Upload Image</p>
              </div>
              <ArrowRight className="hidden h-6 w-6 text-muted-foreground md:block" />
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">AI Reads Receipt</p>
              </div>
              <ArrowRight className="hidden h-6 w-6 text-muted-foreground md:block" />
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium">Export to Excel</p>
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
              Convert Receipt to Excel
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
