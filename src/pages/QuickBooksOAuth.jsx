import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Copy, CheckCircle, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function QuickBooksOAuth() {
  const [refreshToken, setRefreshToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const CLIENT_ID = 'ABEPLCjstgfba5v6oqFoQI7afVCDSWJ2nkmwYm6aAglhTHhAjB';
  const REDIRECT_URI = `${window.location.origin}/QuickBooksOAuth`;

  useEffect(() => {
    // Check if we have a code in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const realmId = urlParams.get('realmId');

    if (code && realmId) {
      exchangeCodeForToken(code, realmId);
    }
  }, []);

  const exchangeCodeForToken = async (code, realmId) => {
    setLoading(true);
    setError('');
    try {
      const response = await base44.functions.invoke('quickbooksOAuthHelper', {
        code,
        realmId,
        redirectUri: REDIRECT_URI
      });

      if (response.data.refresh_token) {
        setRefreshToken(response.data.refresh_token);
      } else {
        setError('Failed to get refresh token: ' + (response.data.error || 'Unknown error'));
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startOAuth = (environment = 'production') => {
    // Use production OAuth - connects to real QuickBooks company
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?` +
      `client_id=${CLIENT_ID}&` +
      `scope=com.intuit.quickbooks.accounting&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=code&` +
      `state=security_token_${Date.now()}`;
    
    window.location.href = authUrl;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(refreshToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#013f7c' }}>
          QuickBooks OAuth Setup
        </h1>
        <p className="text-gray-600 mb-6">
          Get your QuickBooks Refresh Token to enable invoice syncing
        </p>

        {!refreshToken && !loading && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Click the button below to connect to QuickBooks</li>
                <li>Sign in and authorize the app</li>
                <li>You'll be redirected back with your Refresh Token</li>
                <li>Copy the token and add it to Base44 Settings → Secrets as <code className="bg-blue-100 px-1 rounded">Quickbooks_Refresh_Token</code></li>
              </ol>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
                {error}
              </div>
            )}

            <Button 
              onClick={() => startOAuth('production')}
              className="w-full bg-[#2ca01c] hover:bg-[#228917] text-white text-lg py-6"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Connect to Your QuickBooks Company
            </Button>
            <p className="text-xs text-gray-500 text-center mt-2">
              This will connect to your real QuickBooks Online company (not sandbox)
            </p>
          </>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Exchanging authorization code for tokens...</p>
          </div>
        )}

        {refreshToken && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 mb-4">
              <CheckCircle className="w-6 h-6" />
              <span className="font-semibold">Success! Here's your Refresh Token:</span>
            </div>

            <div className="bg-gray-50 border rounded-lg p-4">
              <code className="text-sm break-all">{refreshToken}</code>
            </div>

            <Button 
              onClick={copyToClipboard}
              className="w-full bg-[#264d44] hover:bg-[#1a3830]"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Refresh Token
                </>
              )}
            </Button>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Next Step:</strong> Go to your Base44 dashboard → Settings → Environment Variables/Secrets, 
                and add this token as <code className="bg-amber-100 px-1 rounded">Quickbooks_Refresh_Token</code>
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}