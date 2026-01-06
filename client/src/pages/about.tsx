import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Target,
  Users,
  Lightbulb,
  ArrowRight,
  Building,
  UserCheck,
  Calculator,
  ShoppingCart,
} from "lucide-react";

const targetUsers = [
  {
    icon: Building,
    title: "Small Businesses",
    description: "Eliminate hours of manual invoice entry. Focus on growing your business, not paperwork.",
  },
  {
    icon: UserCheck,
    title: "Freelancers",
    description: "Track expenses effortlessly. Export clean data for tax time without the stress.",
  },
  {
    icon: Calculator,
    title: "Accountants",
    description: "Process client invoices faster. Reduce errors and improve turnaround time.",
  },
  {
    icon: ShoppingCart,
    title: "E-commerce Sellers",
    description: "Manage supplier invoices at scale. Keep your finances organized automatically.",
  },
];

const values = [
  {
    icon: Target,
    title: "Accuracy First",
    description: "We obsess over extraction accuracy because your financial data matters. Every field, every number.",
  },
  {
    icon: Lightbulb,
    title: "Simplicity",
    description: "No complex software to learn. Upload, extract, export. That's it. We believe powerful tools should be simple.",
  },
  {
    icon: Users,
    title: "Privacy by Design",
    description: "Your documents are sensitive. We built InvoiceAI with privacy at its core, not as an afterthought.",
  },
];

export default function About() {
  return (
    <div className="py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <FileText className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-6 text-4xl font-bold md:text-5xl" data-testid="text-about-title">
            Simplifying Document Workflows
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            InvoiceAI exists to eliminate the tedious work of manual invoice data entry. 
            We believe your time is better spent running your business, not copying numbers 
            from PDFs into spreadsheets.
          </p>
        </div>

        <section className="mt-32">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold" data-testid="text-problem-title">
              The Problem We Solve
            </h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Businesses receive invoices in dozens of different formats. PDFs, scanned 
              documents, photos, emails. Getting this data into a structured format means 
              hours of manual copying, inevitable errors, and delayed financial reporting.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              InvoiceAI uses advanced AI to read any invoice format and extract the data 
              you need in seconds. Clean, structured, ready for your accounting software 
              or spreadsheets.
            </p>
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-center text-3xl font-semibold" data-testid="text-who-title">
            Who We Serve
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            Built for anyone who needs to turn paper into data
          </p>
          
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {targetUsers.map((user) => (
              <Card key={user.title} className="p-6">
                <CardContent className="p-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <user.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 font-semibold" data-testid={`text-user-${user.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {user.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {user.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-center text-3xl font-semibold" data-testid="text-values-title">
            Our Values
          </h2>
          
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {values.map((value) => (
              <div key={value.title} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <value.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mt-6 text-xl font-semibold" data-testid={`text-value-${value.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {value.title}
                </h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-32 text-center">
          <h2 className="text-2xl font-semibold" data-testid="text-cta-title">
            Ready to Save Hours Every Week?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start extracting invoice data in seconds. No credit card required.
          </p>
          <Button size="lg" asChild className="mt-8 gap-2" data-testid="button-about-cta">
            <Link href="/app">
              Try InvoiceAI Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
