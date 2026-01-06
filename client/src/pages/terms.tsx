export default function Terms() {
  return (
    <div className="py-20 md:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-4xl font-bold" data-testid="text-terms-title">
          Terms of Service
        </h1>
        <p className="mt-4 text-muted-foreground">
          Last updated: January 2024
        </p>

        <div className="mt-12 space-y-12 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="mt-4">
              By accessing or using InvoiceAI ("Service"), you agree to be bound by 
              these Terms of Service ("Terms"). If you do not agree to these Terms, 
              you may not access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Description of Service</h2>
            <p className="mt-4">
              InvoiceAI provides an AI-powered service that extracts structured data 
              from invoice PDFs and images. The Service allows users to upload documents, 
              extract key information, and export data in various formats.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. User Accounts</h2>
            <p className="mt-4">
              Some features of the Service may require you to create an account. You are 
              responsible for maintaining the confidentiality of your account credentials 
              and for all activities that occur under your account.
            </p>
            <p className="mt-4">
              You agree to provide accurate and complete information when creating an account 
              and to update your information as necessary to keep it accurate.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Acceptable Use</h2>
            <p className="mt-4">You agree not to use the Service to:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Upload content that you do not have the right to process</li>
              <li>Upload malicious files or attempt to compromise the Service</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Use the Service for any illegal purpose</li>
              <li>Resell or redistribute the Service without authorization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Document Processing</h2>
            <p className="mt-4">
              By uploading documents to the Service, you represent that you have the 
              right to process those documents. You retain ownership of all documents 
              you upload. We process your documents solely to provide the extraction 
              service and delete them immediately after processing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Accuracy Disclaimer</h2>
            <p className="mt-4">
              While we strive for high accuracy in data extraction, the Service uses 
              automated AI processing which may occasionally produce errors. You are 
              responsible for reviewing and verifying all extracted data before use 
              in any official capacity.
            </p>
            <p className="mt-4">
              The Service is not intended to replace professional accounting, tax, 
              or legal advice. Extracted data should be verified before use in 
              financial reporting or tax filing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Pricing and Payment</h2>
            <p className="mt-4">
              Certain features of the Service require payment. Prices are subject to 
              change with notice. Paid subscriptions are billed in advance on a 
              recurring basis. You may cancel your subscription at any time.
            </p>
            <p className="mt-4">
              Refunds are provided in accordance with our refund policy. Credits 
              purchased for pay-as-you-go usage do not expire.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Intellectual Property</h2>
            <p className="mt-4">
              The Service, including its design, features, and content, is owned by 
              InvoiceAI and protected by intellectual property laws. You may not copy, 
              modify, distribute, or reverse engineer any part of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Limitation of Liability</h2>
            <p className="mt-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, INVOICEAI SHALL NOT BE LIABLE 
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, 
              OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, 
              OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Disclaimer of Warranties</h2>
            <p className="mt-4">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, WHETHER 
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF 
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Termination</h2>
            <p className="mt-4">
              We may terminate or suspend your access to the Service immediately, 
              without prior notice, for any reason, including breach of these Terms. 
              Upon termination, your right to use the Service will cease immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">12. Changes to Terms</h2>
            <p className="mt-4">
              We reserve the right to modify these Terms at any time. We will provide 
              notice of material changes by posting the new Terms on this page. Your 
              continued use of the Service after changes constitutes acceptance of 
              the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">13. Governing Law</h2>
            <p className="mt-4">
              These Terms shall be governed by and construed in accordance with the 
              laws of the jurisdiction in which InvoiceAI is incorporated, without 
              regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">14. Contact</h2>
            <p className="mt-4">
              For questions about these Terms, please contact us at legal@invoiceai.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
