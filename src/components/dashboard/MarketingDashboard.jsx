import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import TagInsightsSection from './TagInsightsSection';
import EmailMarketingSection from './EmailMarketingSection';
import NotionPipelineSection from './NotionPipelineSection';

export default function MarketingDashboard() {
  const [tab, setTab] = useState('tags');

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="tags">Tag Insights</TabsTrigger>
        <TabsTrigger value="email">Email Marketing</TabsTrigger>
        <TabsTrigger value="notion">Notion (legacy)</TabsTrigger>
      </TabsList>
      <TabsContent value="tags" className="mt-6">
        <TagInsightsSection />
      </TabsContent>
      <TabsContent value="email" className="mt-6">
        <EmailMarketingSection />
      </TabsContent>
      <TabsContent value="notion" className="mt-6">
        <NotionPipelineSection />
      </TabsContent>
    </Tabs>
  );
}