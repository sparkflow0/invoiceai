import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { 
  FileText, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  ChevronDown 
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const toolLinks = [
  { href: "/tools/invoice-pdf-to-excel", label: "Invoice PDF to Excel" },
  { href: "/tools/receipt-to-excel", label: "Receipt to Excel" },
  { href: "/tools/extract-vat", label: "Extract VAT from Invoice" },
  { href: "/tools/data-extraction", label: "AI Data Extraction" },
];

const navLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/about", label: "About" },
];

export function Header() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">InvoiceAI</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1" data-testid="dropdown-tools">
                  Tools
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {toolLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href} data-testid={`link-tool-${link.href.split('/').pop()}`}>
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {navLinks.map((link) => (
              <Button
                key={link.href}
                variant="ghost"
                asChild
                className={location === link.href ? "bg-accent" : ""}
              >
                <Link href={link.href} data-testid={`link-${link.label.toLowerCase()}`}>
                  {link.label}
                </Link>
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>

            <Button asChild className="hidden sm:inline-flex" data-testid="button-upload-cta">
              <Link href="/app">Upload Invoice</Link>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="border-t py-4 md:hidden">
            <div className="flex flex-col gap-2">
              <div className="px-2 py-1 text-sm font-medium text-muted-foreground">
                Tools
              </div>
              {toolLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm hover-elevate"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`mobile-link-tool-${link.href.split('/').pop()}`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="my-2 border-t" />
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm hover-elevate"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`mobile-link-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 px-2">
                <Button asChild className="w-full" data-testid="mobile-button-upload">
                  <Link href="/app" onClick={() => setMobileMenuOpen(false)}>
                    Upload Invoice
                  </Link>
                </Button>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
