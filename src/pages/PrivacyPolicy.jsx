import React from 'react';
import { Card } from '@/components/ui/card';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-6" style={{ color: '#013f7c' }}>
            Privacy Policy
          </h1>
          
          <div className="prose prose-slate max-w-none">
            <p className="text-sm text-gray-500 mb-6">
              Last Updated: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                1. Information We Collect
              </h2>
              <p className="text-gray-700 mb-3">
                We collect information that you provide directly to us when using the SKMS Wellness Campaigns platform:
              </p>
              <ul className="list-disc ml-6 text-gray-700 mb-3">
                <li><strong>Account Information:</strong> Name, email address, and credentials</li>
                <li><strong>Client Data:</strong> Client names, contact information, company details, and interaction history</li>
                <li><strong>Business Information:</strong> Proposals, invoices, calendar events, and service selections</li>
                <li><strong>Usage Data:</strong> Information about how you interact with our Service</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                2. How We Use Your Information
              </h2>
              <p className="text-gray-700 mb-3">We use the information we collect to:</p>
              <ul className="list-disc ml-6 text-gray-700 mb-3">
                <li>Provide, maintain, and improve our Service</li>
                <li>Process transactions and send related information</li>
                <li>Send administrative messages, updates, and security alerts</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Facilitate integrations with third-party services you authorize</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                3. Third-Party Integrations
              </h2>
              <p className="text-gray-700 mb-3">
                Our Service integrates with third-party platforms to enhance functionality:
              </p>
              <ul className="list-disc ml-6 text-gray-700 mb-3">
                <li><strong>QuickBooks:</strong> We access invoice and customer data when you authorize this integration</li>
                <li><strong>Google Sheets:</strong> We sync scheduling data from your authorized spreadsheets</li>
                <li><strong>Google Calendar:</strong> We access and sync calendar events when authorized</li>
                <li><strong>Email Services:</strong> We use email providers to send proposals and communications on your behalf</li>
              </ul>
              <p className="text-gray-700 mb-3">
                These integrations only access data that you explicitly authorize, and are subject to the third parties' own privacy policies.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                4. Information Sharing and Disclosure
              </h2>
              <p className="text-gray-700 mb-3">
                We do not sell, trade, or rent your personal information to third parties. We may share information in the following circumstances:
              </p>
              <ul className="list-disc ml-6 text-gray-700 mb-3">
                <li><strong>With Your Consent:</strong> When you direct us to share information with third-party services</li>
                <li><strong>Service Providers:</strong> With vendors who perform services on our behalf (hosting, analytics, email delivery)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect rights, property, or safety</li>
                <li><strong>Business Transfers:</strong> In connection with any merger, sale, or transfer of assets</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                5. Data Security
              </h2>
              <p className="text-gray-700 mb-3">
                We implement industry-standard security measures to protect your information:
              </p>
              <ul className="list-disc ml-6 text-gray-700 mb-3">
                <li>Encrypted data transmission using SSL/TLS</li>
                <li>Secure data storage with access controls</li>
                <li>Regular security assessments and updates</li>
                <li>Authentication and authorization mechanisms</li>
              </ul>
              <p className="text-gray-700 mb-3">
                However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security of your data.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                6. Data Retention
              </h2>
              <p className="text-gray-700 mb-3">
                We retain your information for as long as necessary to provide our Service and fulfill the purposes outlined in this policy. You may request deletion of your data at any time, subject to legal and contractual obligations.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                7. Your Rights and Choices
              </h2>
              <p className="text-gray-700 mb-3">You have the right to:</p>
              <ul className="list-disc ml-6 text-gray-700 mb-3">
                <li><strong>Access:</strong> Request a copy of your personal information</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                <li><strong>Revoke Authorization:</strong> Disconnect third-party integrations at any time</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                8. Cookies and Tracking
              </h2>
              <p className="text-gray-700 mb-3">
                We use cookies and similar tracking technologies to enhance your experience, analyze usage, and maintain authentication. You can control cookie settings through your browser preferences.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                9. Children's Privacy
              </h2>
              <p className="text-gray-700 mb-3">
                Our Service is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                10. Changes to This Policy
              </h2>
              <p className="text-gray-700 mb-3">
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                11. Contact Us
              </h2>
              <p className="text-gray-700 mb-3">
                If you have questions or concerns about this privacy policy or our data practices, please contact us through the platform.
              </p>
            </section>

            <div className="mt-8 p-4 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-600">
                By using the SKMS Wellness Campaigns platform, you acknowledge that you have read and understood this Privacy Policy.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}