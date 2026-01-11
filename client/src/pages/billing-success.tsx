import { Link } from "wouter";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BillingSuccess() {
  return (
    <div className="py-20 md:py-28">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="mt-6 text-3xl font-bold md:text-4xl">
          You’re upgraded!
        </h1>
        <p className="mt-4 text-muted-foreground">
          Your Pro plan is now active. You can process unlimited documents and
          keep extracting without daily limits.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/app">Start Uploading</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
