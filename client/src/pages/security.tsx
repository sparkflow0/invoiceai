import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Shield,
  Lock,
  Trash2,
  Server,
  Eye,
  FileCheck,
  Clock,
  Globe,
} from "lucide-react";

const securityFeatures = [
  {
    icon: Lock,
    title: "256-bit Encryption",
    description: "All files are encrypted using AES-256 encryption during upload, processing, and storage. Your data is protected with military-grade security.",
  },
  {
    icon: Trash2,
    title: "Automatic Deletion",
    description: "Files are automatically and permanently deleted from our servers immediately after processing is complete. No data is retained.",
  },
  {
    icon: Eye,
    title: "No AI Training",
    description: "We never use your documents or extracted data to train our AI models. Your business information remains strictly confidential.",
  },
  {
    icon: Server,
    title: "Secure Infrastructure",
    description: "Our infrastructure runs on enterprise-grade cloud providers with SOC 2 compliance, regular security audits, and 24/7 monitoring.",
  },
  {
    icon: FileCheck,
    title: "GDPR Compliant",
    description: "We comply with GDPR and other international data protection regulations. You have full control over your data.",
  },
  {
    icon: Clock,
    title: "Temporary Processing",
    description: "Document processing happens in isolated, ephemeral environments. No persistent storage of your sensitive information.",
  },
];

const commitments = [
  "Your files are never stored beyond the processing session",
  "We do not access your documents for any purpose other than extraction",
  "Extracted data is only available to you during your session",
  "No third parties have access to your documents or data",
  "You can request complete data deletion at any time",
  "All processing happens in secure, isolated environments",
];

export default function Security() {
  return (
    <div className="py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 text-4xl font-bold md:text-5xl" data-testid="text-security-title">
            Enterprise-Grade Security
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Your documents contain sensitive business information. We've built InvoiceAI 
            with security as a core principle, not an afterthought.
          </p>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {securityFeatures.map((feature) => (
            <Card key={feature.title} className="p-6">
              <CardContent className="p-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold" data-testid={`text-security-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="mt-32">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-semibold" data-testid="text-commitment-title">
              Our Privacy Commitment
            </h2>
            <p className="mt-4 text-center text-muted-foreground">
              We believe privacy is a fundamental right, not a feature.
            </p>
            
            <Card className="mt-12 p-8">
              <CardContent className="p-0">
                <ul className="space-y-4">
                  {commitments.map((commitment, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                      <span className="text-foreground/90">{commitment}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-32">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-center gap-3">
              <Globe className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold" data-testid="text-compliance-title">
                Compliance & Standards
              </h2>
            </div>
            <p className="mt-4 text-center text-muted-foreground">
              InvoiceAI is designed to meet the security requirements of businesses worldwide.
            </p>
            
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Card className="p-6 text-center">
                <CardContent className="p-0">
                  <h3 className="font-semibold">GDPR</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Full compliance with European data protection regulations
                  </p>
                </CardContent>
              </Card>
              <Card className="p-6 text-center">
                <CardContent className="p-0">
                  <h3 className="font-semibold">SOC 2</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Infrastructure certified for security and availability
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="mt-32 text-center">
          <h2 className="text-2xl font-semibold" data-testid="text-questions-title">
            Have Security Questions?
          </h2>
          <p className="mt-4 text-muted-foreground">
            We're happy to provide additional documentation for your compliance needs.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild data-testid="button-contact-security">
              <Link href="/about">Contact Us</Link>
            </Button>
            <Button variant="outline" asChild data-testid="button-view-privacy">
              <Link href="/privacy">View Privacy Policy</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
