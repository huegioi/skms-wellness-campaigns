import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CampaignCalendarTab from '@/components/campaign/CampaignCalendarTab';
import OutreachCampaignsTab from '@/components/campaign/OutreachCampaignsTab';
import NetworkingEventsTab from '@/components/campaign/NetworkingEventsTab';

export default function CampaignCalendar() {
  // ?tab=outreach&campaign=<id> — Maya's "Draft follow-ups" opens a campaign directly
  const params = new URLSearchParams(window.location.search);
  const tab = ['calendar', 'outreach', 'networking'].includes(params.get('tab')) ? params.get('tab') : 'calendar';
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 pb-20">
      <Tabs defaultValue={tab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="calendar">Campaign Calendar</TabsTrigger>
          <TabsTrigger value="outreach">Outreach Campaigns</TabsTrigger>
          <TabsTrigger value="networking">Networking Events</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar">
          <CampaignCalendarTab />
        </TabsContent>
        <TabsContent value="outreach">
          <OutreachCampaignsTab initialCampaignId={params.get('campaign')} />
        </TabsContent>
        <TabsContent value="networking">
          <NetworkingEventsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}