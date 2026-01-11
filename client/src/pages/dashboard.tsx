import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Upload, 
  History, 
  LogOut,
  Clock,
  CheckCircle,
  TrendingUp
} from "lucide-react";

export default function Dashboard() {
  const { user, isLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Please log in",
        description: "Redirecting to login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isLoading, isAuthenticated, toast]);

  if (isLoading) {
    return (
      <div className="py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const stats = [
    { label: "Invoices Processed", value: "0", icon: FileText, change: "Start uploading" },
    { label: "This Month", value: "0", icon: TrendingUp, change: "No activity yet" },
    { label: "Average Time", value: "-", icon: Clock, change: "No data" },
  ];

  return (
    <div className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
              <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-user-name">
                {user?.firstName ? `Welcome, ${user.firstName}` : "Welcome"}
              </h1>
              <p className="text-muted-foreground" data-testid="text-user-email">
                {user?.email || "No email provided"}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => logout()} 
            disabled={isLoggingOut}
            className="gap-2"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Logging out..." : "Log Out"}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Invoice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Upload a new invoice or receipt to extract structured data using AI.
              </p>
              <Button asChild data-testid="button-upload-invoice">
                <Link href="/app">Upload Now</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent extractions</p>
                <p className="text-sm">Upload your first invoice to get started</p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/history">View history</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              Quick Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">1.</span>
                Upload PDF invoices or receipt images (JPG, PNG)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">2.</span>
                Our AI extracts vendor, amounts, dates, and line items automatically
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">3.</span>
                Review and edit the extracted data if needed
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">4.</span>
                Export to Excel or CSV for your accounting software
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
