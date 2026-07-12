import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, ExternalLink, User, Building2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function DemoLinkCard({ name, company, url, description, type }) {
  const { toast } = useToast();
  const Icon = type === 'broker' ? User : Building2;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied', description: `${company} portal link is on your clipboard.` });
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <div className={`p-2 rounded-lg ${type === 'broker' ? 'bg-blue-50' : 'bg-green-50'}`}>
            <Icon className={`w-4 h-4 ${type === 'broker' ? 'text-blue-600' : 'text-green-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 truncate">{name}</p>
            <p className="text-sm text-gray-500 truncate">{company}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-3 min-h-[2.5rem]">{description}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
          </Button>
          <Button size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}