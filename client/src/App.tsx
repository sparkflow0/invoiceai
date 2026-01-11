import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import UploadApp from "@/pages/upload-app";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import Pricing from "@/pages/pricing";
import Security from "@/pages/security";
import About from "@/pages/about";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import PdfTools from "@/pages/pdf-tools";
import BillingSuccess from "@/pages/billing-success";
import HistoryPage from "@/pages/history";
import InvoicePdfToExcel from "@/pages/tools/invoice-pdf-to-excel";
import ReceiptToExcel from "@/pages/tools/receipt-to-excel";
import ExtractVat from "@/pages/tools/extract-vat";
import DataExtraction from "@/pages/tools/data-extraction";
import WorkflowNew from "@/pages/workflow-new";
import WorkflowView from "@/pages/workflow-view";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/app" component={UploadApp} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/login" component={Login} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/billing/success" component={BillingSuccess} />
      <Route path="/security" component={Security} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/tools/pdf-tools" component={PdfTools} />
      <Route path="/tools/invoice-pdf-to-excel" component={InvoicePdfToExcel} />
      <Route path="/tools/receipt-to-excel" component={ReceiptToExcel} />
      <Route path="/tools/extract-vat" component={ExtractVat} />
      <Route path="/tools/data-extraction" component={DataExtraction} />
      <Route path="/workflows/new" component={WorkflowNew} />
      <Route path="/workflows/:id" component={WorkflowView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Layout>
            <Router />
          </Layout>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
