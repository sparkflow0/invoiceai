export default function Privacy() {
  return (
    <div className="py-20 md:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-4xl font-bold" data-testid="text-privacy-title">
          Privacy Policy
        </h1>
        <p className="mt-4 text-muted-foreground">
          Last updated: January 2024
        </p>

        <div className="mt-12 space-y-12 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold">1. Introduction</h2>
            <p className="mt-4">
              InvoiceAI ("we," "our," or "us") is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard 
              your information when you use our invoice data extraction service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Information We Collect</h2>
            <p className="mt-4">
              <strong>Documents You Upload:</strong> When you use our service, you may upload 
              invoice PDFs and images for data extraction. These files are processed temporarily 
              and automatically deleted immediately after processing is complete.
            </p>
            <p className="mt-4">
              <strong>Usage Information:</strong> We may collect non-personal information about 
              how you interact with our service, including browser type, access times, and pages 
              viewed, to improve our service.
            </p>
            <p className="mt-4">
              <strong>Account Information:</strong> If you create an account or subscribe to 
              a paid plan, we collect the information necessary to manage your account and 
              process payments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
            <p className="mt-4">We use the information we collect to:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Provide and maintain our invoice data extraction service</li>
              <li>Process and extract data from your uploaded documents</li>
              <li>Process transactions and send related information</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Improve our service and develop new features</li>
              <li>Monitor and analyze usage patterns and trends</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Document Handling</h2>
            <p className="mt-4">
              <strong>Temporary Processing:</strong> Documents you upload are processed in 
              temporary, isolated environments. Files are not stored on persistent storage 
              and are automatically deleted immediately after extraction is complete.
            </p>
            <p className="mt-4">
              <strong>No Training on Your Data:</strong> We do not use your uploaded documents 
              or extracted data to train our AI models. Your business information remains 
              strictly confidential.
            </p>
            <p className="mt-4">
              <strong>Encryption:</strong> All files are encrypted during upload and processing 
              using industry-standard encryption protocols.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Data Sharing</h2>
            <p className="mt-4">
              We do not sell, trade, or otherwise transfer your personal information or 
              uploaded documents to third parties. We may share information only:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>With service providers who assist in operating our service (under strict confidentiality agreements)</li>
              <li>To comply with legal obligations or respond to lawful requests</li>
              <li>To protect our rights, privacy, safety, or property</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Data Security</h2>
            <p className="mt-4">
              We implement appropriate technical and organizational security measures to 
              protect your information. These include encryption, secure infrastructure, 
              access controls, and regular security assessments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Your Rights</h2>
            <p className="mt-4">
              Depending on your location, you may have rights regarding your personal 
              information, including:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>The right to access information we hold about you</li>
              <li>The right to request correction of inaccurate information</li>
              <li>The right to request deletion of your information</li>
              <li>The right to withdraw consent where processing is based on consent</li>
              <li>The right to data portability</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Cookies</h2>
            <p className="mt-4">
              We may use cookies and similar tracking technologies to enhance your experience, 
              remember preferences, and analyze service usage. You can control cookie preferences 
              through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Changes to This Policy</h2>
            <p className="mt-4">
              We may update this Privacy Policy from time to time. We will notify you of 
              any material changes by posting the new policy on this page and updating 
              the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Contact Us</h2>
            <p className="mt-4">
              If you have questions about this Privacy Policy or our data practices, 
              please contact us at privacy@invoiceai.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
