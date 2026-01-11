import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const EMAIL_STORAGE_KEY = "invoiceai_signin_email";
const NEXT_STORAGE_KEY = "invoiceai_signin_next";

export default function Login() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [needsEmailForLink, setNeedsEmailForLink] = useState(false);
  const nextParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next") || ""
      : "";
  const redirectPath = nextParam || "/dashboard";

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [isLoading, user, setLocation]);

  useEffect(() => {
    const maybeCompleteSignIn = async () => {
      if (!isSignInWithEmailLink(auth, window.location.href)) return;
      const storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY) || "";
      if (!storedEmail) {
        setNeedsEmailForLink(true);
        return;
      }
      setIsSubmitting(true);
      try {
        await signInWithEmailLink(auth, storedEmail, window.location.href);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        const storedNext = window.localStorage.getItem(NEXT_STORAGE_KEY);
        window.localStorage.removeItem(NEXT_STORAGE_KEY);
        setLocation(storedNext || redirectPath);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to complete sign-in.";
        toast({
          title: "Sign in failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    };

    maybeCompleteSignIn();
  }, [setLocation, toast]);

  const handleSendMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Enter your email address to receive a magic link.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
      if (nextParam) {
        window.localStorage.setItem(NEXT_STORAGE_KEY, nextParam);
      }
      setLinkSent(true);
      toast({
        title: "Magic link sent",
        description: "Check your inbox to finish signing in.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send magic link.";
      toast({
        title: "Sign in failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Enter the email you used to request the link.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem(EMAIL_STORAGE_KEY);
      const storedNext = window.localStorage.getItem(NEXT_STORAGE_KEY);
      window.localStorage.removeItem(NEXT_STORAGE_KEY);
      setLocation(storedNext || redirectPath);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to complete sign-in.";
      toast({
        title: "Sign in failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setLocation(redirectPath);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google sign-in failed.";
      toast({
        title: "Sign in failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-12 md:py-20">
      <div className="mx-auto max-w-md px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              Sign in to InvoiceAI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              className="w-full"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              data-testid="button-google-signin"
            >
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            <form
              className="space-y-4"
              onSubmit={needsEmailForLink ? handleCompleteLink : handleSendMagicLink}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                />
              </div>
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {needsEmailForLink ? "Finish Sign In" : "Email Me a Magic Link"}
              </Button>
              {linkSent && !needsEmailForLink && (
                <p className="text-center text-xs text-muted-foreground">
                  Check your inbox for the sign-in link.
                </p>
              )}
            </form>

            <div className="text-center text-sm text-muted-foreground">
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setLocation("/app")}
                disabled={isSubmitting}
              >
                Continue without signing in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
