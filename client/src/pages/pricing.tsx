import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, X } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { PageMeta } from "@/components/seo/page-meta";
import { FaqSchema } from "@/components/seo/faq-schema";

const metaDescription =
  "Compare Free and Pro plans for InvoiceAI. Upgrade for unlimited processing, bulk uploads, and history.";

const plans = [
  {
    id: "free",
    name: "Free",
    description: "For individuals getting started",
    price: 0,
    period: "forever",
    features: [
      { text: "3 documents per day", included: true },
      { text: "PDF, JPG, PNG support", included: true },
      { text: "Excel & CSV export", included: true },
      { text: "Document history", included: false },
      { text: "Basic OCR accuracy", included: true },
      { text: "Email support", included: false },
      { text: "API access", included: false },
      { text: "Bulk upload", included: false },
    ],
    cta: "Get Started",
    href: "/app",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing businesses",
    price: 19,
    period: "per month",
    features: [
      { text: "Unlimited documents", included: true },
      { text: "PDF, JPG, PNG support", included: true },
      { text: "Excel & CSV export", included: true },
      { text: "Document history (30-90 days)", included: true },
      { text: "Enhanced AI accuracy", included: true },
      { text: "Priority email support", included: true },
      { text: "API access", included: true },
      { text: "Bulk upload (up to 10)", included: true },
    ],
    cta: "Start Pro Trial",
    href: "/app",
    highlighted: true,
  },
  {
    id: "credits",
    name: "Pay As You Go",
    description: "For occasional users",
    price: 0.50,
    period: "per document",
    features: [
      { text: "No monthly commitment", included: true },
      { text: "PDF, JPG, PNG support", included: true },
      { text: "Excel & CSV export", included: true },
      { text: "Document history", included: false },
      { text: "Enhanced AI accuracy", included: true },
      { text: "Email support", included: true },
      { text: "API access", included: true },
      { text: "Credits never expire", included: true },
    ],
    cta: "Buy Credits",
    href: "/app",
    highlighted: false,
  },
];

const faqs = [
  {
    question: "What file formats are supported?",
    answer: "We support PDF documents, JPG images, and PNG images. This covers most invoice and receipt formats including scanned documents and phone photos.",
  },
  {
    question: "How accurate is the data extraction?",
    answer: "Our AI achieves over 95% accuracy on standard invoice formats. Complex or handwritten documents may have lower accuracy. You can always edit extracted data before exporting.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. All files are encrypted during upload and processing. Files are automatically deleted after processing is complete. We never use your data for AI training.",
  },
  {
    question: "Can I cancel my subscription?",
    answer: "Yes, you can cancel your Pro subscription at any time. You'll retain access until the end of your billing period. Pay-as-you-go credits never expire.",
  },
  {
    question: "Do you offer enterprise plans?",
    answer: "Yes, we offer custom enterprise solutions with dedicated support, custom integrations, and volume pricing. Contact us for details.",
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const handleUpgrade = async () => {
    void trackEvent("upgrade_click");
    if (!user) {
      setLocation("/login?next=/pricing");
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const response = await apiRequest("POST", "/api/billing/checkout");
      const data = (await response.json()) as { url?: string };
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      throw new Error("Checkout URL not returned.");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Unable to start checkout.";
      toast({
        title: "Upgrade failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return (
    <div className="py-20 md:py-32">
      <PageMeta title="Pricing | InvoiceAI" description={metaDescription} />
      <FaqSchema faqs={faqs} />
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold md:text-5xl" data-testid="text-pricing-title">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Choose the plan that fits your needs. No hidden fees, no surprises.
            Start free and upgrade as you grow.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col p-8 ${
                plan.highlighted ? "border-primary" : ""
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="p-0">
                <CardTitle className="text-2xl" data-testid={`text-plan-${plan.id}-name`}>
                  {plan.name}
                </CardTitle>
                <CardDescription className="mt-2">
                  {plan.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col p-0 pt-6">
                <div className="mb-8">
                  <span className="text-4xl font-bold" data-testid={`text-plan-${plan.id}-price`}>
                    ${plan.price}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}{plan.period}
                  </span>
                </div>

                <ul className="flex-1 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-3">
                      {feature.included ? (
                        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      ) : (
                        <X className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className={feature.included ? "" : "text-muted-foreground/50"}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-8 w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  data-testid={`button-plan-${plan.id}`}
                  onClick={plan.id === "pro" ? handleUpgrade : undefined}
                  disabled={plan.id === "pro" && isCheckoutLoading}
                  asChild={plan.id !== "pro"}
                >
                  {plan.id === "pro" ? (
                    <span>{isCheckoutLoading ? "Redirecting..." : plan.cta}</span>
                  ) : (
                    <Link href={plan.href}>{plan.cta}</Link>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="mt-32">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-semibold" data-testid="text-faq-title">
              Frequently Asked Questions
            </h2>
            <div className="mt-12 space-y-8">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b pb-8 last:border-0">
                  <h3 className="text-lg font-medium" data-testid={`text-faq-${index}-question`}>
                    {faq.question}
                  </h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
