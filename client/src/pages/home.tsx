import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageMeta } from "@/components/seo/page-meta";
import { 
  Upload, 
  Zap, 
  Download, 
  Shield, 
  Clock, 
  CheckCircle, 
  FileSpreadsheet,
  Scan,
  Calculator,
  Lock,
  ArrowRight
} from "lucide-react";

const metaDescription =
  "AI-powered invoice and receipt data extraction. Convert PDFs and images to Excel or CSV in seconds.";

const steps = [
  {
    icon: Upload,
    title: "Upload Document",
    description: "Drag and drop your invoice PDF or receipt image. Supports PDF, JPG, and PNG formats.",
  },
  {
    icon: Zap,
    title: "AI Processing",
    description: "Our AI extracts vendor details, amounts, dates, VAT, and line items with high accuracy.",
  },
  {
    icon: Download,
    title: "Export Data",
    description: "Download clean, structured data as Excel or CSV. Edit results before exporting.",
  },
];

const features = [
  {
    icon: Scan,
    title: "OCR + AI Understanding",
    description: "Advanced recognition handles scans, photos, and complex layouts with precision.",
  },
  {
    icon: Clock,
    title: "Process in Seconds",
    description: "Extract data from invoices in under 10 seconds. No manual data entry required.",
  },
  {
    icon: Calculator,
    title: "Accurate VAT Extraction",
    description: "Automatically identify and extract VAT amounts, reducing tax compliance errors.",
  },
  {
    icon: FileSpreadsheet,
    title: "Clean Excel Export",
    description: "Get structured spreadsheets ready for your accounting software or reports.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Files are encrypted and auto-deleted after processing. No data training.",
  },
  {
    icon: CheckCircle,
    title: "No Software Required",
    description: "Works directly in your browser. No installation, no accounting software needed.",
  },
];

const trustBadges = [
  { icon: Lock, label: "256-bit Encryption" },
  { icon: Shield, label: "GDPR Compliant" },
  { icon: Clock, label: "Auto-delete Files" },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <PageMeta
        title="InvoiceAI - Turn Invoices into Structured Data in Seconds"
        description={metaDescription}
      />
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <h1 
              className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
              data-testid="text-hero-headline"
            >
              Turn invoices into
              <span className="block text-primary">structured data in seconds</span>
            </h1>
            <p 
              className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl leading-relaxed"
              data-testid="text-hero-subheadline"
            >
              AI-powered extraction converts your invoice PDFs and receipt images 
              into clean, editable spreadsheets. Export to Excel or CSV with confidence.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild className="gap-2 px-8" data-testid="button-hero-upload">
                <Link href="/app">
                  <Upload className="h-5 w-5" />
                  Upload Invoice
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="gap-2" data-testid="button-hero-sample">
                <Link href="/app?sample=true">
                  Try with Sample File
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold md:text-4xl" data-testid="text-how-it-works-title">
              How It Works
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Three simple steps to extract invoice data
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <div className="absolute -top-2 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <h3 className="mt-6 text-xl font-semibold" data-testid={`text-step-${index + 1}-title`}>
                  {step.title}
                </h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold md:text-4xl" data-testid="text-features-title">
              Powerful Features
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Everything you need for accurate invoice data extraction
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6">
                <CardContent className="p-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold" data-testid={`text-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {trustBadges.map((badge) => (
              <div 
                key={badge.label} 
                className="flex items-center gap-3"
                data-testid={`badge-${badge.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <badge.icon className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold md:text-4xl" data-testid="text-pricing-preview-title">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Start free, upgrade as you grow
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:mx-auto lg:max-w-4xl">
            <Card className="p-8">
              <CardContent className="p-0">
                <h3 className="text-xl font-semibold">Free</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="mt-6 space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    3 documents per day
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Excel & CSV export
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    All document types
                  </li>
                </ul>
                <Button variant="outline" className="mt-8 w-full" asChild data-testid="button-pricing-free">
                  <Link href="/app">Get Started</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="relative overflow-visible border-primary p-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                  Popular
                </span>
              </div>
              <CardContent className="p-0">
                <h3 className="text-xl font-semibold">Pro</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$19</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="mt-6 space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Unlimited documents
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Priority processing
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Bulk upload support
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    API access
                  </li>
                </ul>
                <Button className="mt-8 w-full" asChild data-testid="button-pricing-pro">
                  <Link href="/pricing">View Plans</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t bg-primary py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-2xl font-semibold text-primary-foreground md:text-3xl" data-testid="text-cta-title">
            Ready to automate your invoice processing?
          </h2>
          <p className="mt-4 text-primary-foreground/80">
            Start extracting data from your invoices in seconds.
          </p>
          <Button 
            size="lg" 
            variant="secondary" 
            asChild 
            className="mt-8 gap-2"
            data-testid="button-final-cta"
          >
            <Link href="/app">
              <Upload className="h-5 w-5" />
              Upload Your First Invoice
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
