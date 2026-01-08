import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type AuthMode = "signin" | "signup";

export default function Login() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [isLoading, user, setLocation]);

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      toast({
        title: "Missing details",
        description: "Enter an email and password to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setLocation("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Authentication failed.";
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
      setLocation("/dashboard");
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
              {mode === "signin" ? "Sign in to InvoiceAI" : "Create your account"}
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

            <form className="space-y-4" onSubmit={handleEmailAuth}>
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
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                />
              </div>
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Please wait..."
                  : mode === "signin"
                    ? "Sign In"
                    : "Create Account"}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? "Need an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() =>
                  setMode((current) =>
                    current === "signin" ? "signup" : "signin",
                  )
                }
                disabled={isSubmitting}
              >
                {mode === "signin" ? "Create one" : "Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
