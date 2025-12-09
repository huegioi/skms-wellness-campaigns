import React from 'react';
import { Card } from '@/components/ui/card';

export default function UserAgreement() {
  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-6" style={{ color: '#013f7c' }}>
            End User License Agreement
          </h1>
          
          <div className="prose prose-slate max-w-none">
            <p className="text-sm text-gray-500 mb-6">
              Last Updated: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-700 mb-3">
                By accessing and using the SKMS Wellness Campaigns platform ("Service"), you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                2. Use of Service
              </h2>
              <p className="text-gray-700 mb-3">
                The Service is provided for the purpose of managing wellness campaigns, client relationships, proposals, and related business operations. You agree to use the Service only for lawful purposes and in accordance with these terms.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                3. Data and Privacy
              </h2>
              <p className="text-gray-700 mb-3">
                We are committed to protecting your privacy. Any personal information you provide will be handled in accordance with applicable data protection laws. Your data will be used solely for the purpose of providing and improving our Service.
              </p>
              <ul className="list-disc ml-6 text-gray-700 mb-3">
                <li>We collect and store client information, proposals, and business data</li>
                <li>We integrate with third-party services (QuickBooks, Google Sheets, Google Calendar) with your explicit consent</li>
                <li>You retain ownership of all data you input into the system</li>
                <li>We implement industry-standard security measures to protect your data</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                4. Third-Party Integrations
              </h2>
              <p className="text-gray-700 mb-3">
                The Service integrates with third-party platforms including:
              </p>
              <ul className="list-disc ml-6 text-gray-700 mb-3">
                <li><strong>QuickBooks:</strong> For invoice creation and synchronization</li>
                <li><strong>Google Sheets:</strong> For schedule management and data synchronization</li>
                <li><strong>Google Calendar:</strong> For event management</li>
              </ul>
              <p className="text-gray-700 mb-3">
                By connecting these services, you grant us permission to access and sync data as necessary to provide functionality. These integrations are subject to the respective third-party terms of service and privacy policies.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                5. User Responsibilities
              </h2>
              <p className="text-gray-700 mb-3">You agree to:</p>
              <ul className="list-disc ml-6 text-gray-700 mb-3">
                <li>Maintain the confidentiality of your account credentials</li>
                <li>Provide accurate and complete information</li>
                <li>Notify us immediately of any unauthorized access to your account</li>
                <li>Use the Service in compliance with all applicable laws and regulations</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                6. Intellectual Property
              </h2>
              <p className="text-gray-700 mb-3">
                All content, features, and functionality of the Service are owned by SKMS Wellness and are protected by copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                7. Limitation of Liability
              </h2>
              <p className="text-gray-700 mb-3">
                The Service is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                8. Service Modifications
              </h2>
              <p className="text-gray-700 mb-3">
                We reserve the right to modify, suspend, or discontinue the Service at any time without notice. We may also update these terms periodically, and continued use constitutes acceptance of modified terms.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                9. Termination
              </h2>
              <p className="text-gray-700 mb-3">
                We may terminate or suspend your access to the Service immediately, without prior notice, for any breach of these terms.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#264d44' }}>
                10. Contact Information
              </h2>
              <p className="text-gray-700 mb-3">
                For questions about these terms, please contact us through the platform.
              </p>
            </section>

            <div className="mt-8 p-4 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-600">
                By using the SKMS Wellness Campaigns platform, you acknowledge that you have read, understood, and agree to be bound by these terms and conditions.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}