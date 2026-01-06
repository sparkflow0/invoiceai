# InvoiceAI - AI-Powered Invoice Data Extraction Platform

## Overview

InvoiceAI is a modern SaaS platform that uses AI to extract structured data from invoice PDFs and receipt images. Users can upload documents, view extracted data in an editable table, and export to Excel or CSV formats.

**Core Value Proposition:** Turn invoices and receipts into clean, structured data in seconds.

## Recent Changes

- **January 2026:** Initial MVP implementation with all core pages and functionality

## Architecture

### Frontend (React + TypeScript)
- **Framework:** React with Vite
- **Routing:** Wouter for client-side routing
- **Styling:** Tailwind CSS with shadcn/ui components
- **State Management:** TanStack Query for server state
- **Theme:** Dark/light mode with localStorage persistence

### Backend (Express)
- **Runtime:** Node.js with Express
- **Storage:** In-memory storage (appropriate for temporary document processing)
- **Processing:** Simulated AI extraction with realistic mock data

## Pages Structure

- `/` - Homepage with hero, features, how-it-works, pricing preview
- `/app` - Main upload application with drag-drop, processing, editable results
- `/pricing` - Three-tier pricing with feature comparison
- `/security` - Security features and privacy commitments
- `/about` - Company mission and target users
- `/privacy` - Privacy Policy
- `/terms` - Terms of Service
- `/tools/invoice-pdf-to-excel` - SEO landing page
- `/tools/receipt-to-excel` - SEO landing page
- `/tools/extract-vat` - SEO landing page
- `/tools/data-extraction` - SEO landing page

## Key Components

- `Layout` - Wraps all pages with Header and Footer
- `Header` - Sticky navigation with tools dropdown, theme toggle
- `Footer` - 4-column footer with links
- `ThemeProvider` - Dark/light mode context

## API Endpoints

- `POST /api/sessions` - Create a new processing session
- `GET /api/sessions/:id` - Get session status
- `POST /api/sessions/:id/process` - Process document with AI
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/export/csv` - Export data as CSV

## Design System

Follows `design_guidelines.md` with:
- Deep blue primary color (`217 85% 42%`)
- Neutral slate backgrounds
- Inter font family
- Minimal, professional aesthetic inspired by Stripe/Notion
- Dark mode support with proper color contrast

## User Preferences

- Enterprise-calm, professional tone
- No emojis in UI
- Outcome-driven CTAs ("Upload Invoice", "Extract Data")
- Security messaging prominent throughout
