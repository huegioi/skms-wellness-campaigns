import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, RefreshCw, Check, AlertCircle, Loader2, 
  Calendar, ArrowLeftRight, ArrowRight, ArrowLeft, X
} from 'lucide-react';

export default function CalendarSyncSettings({ open, onOpenChange }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [googleCalendars, setGoogleCalendars] = useState([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: syncSettings, isLoading } = useQuery({
    queryKey: ['calendarSync', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const settings = await base44.entities.CalendarSync.filter({ user_email: user.email });
      return settings[0] || null;
    },
    enabled: !!user?.email
  });

  const [formData, setFormData] = useState({
    google_enabled: false,
    google_calendar_id: 'primary',
    google_sync_direction: 'both',
    sync_keywords: []
  });

  useEffect(() => {
    if (syncSettings) {
      setFormData({
        google_enabled: syncSettings.google_enabled || false,
        google_calendar_id: syncSettings.google_calendar_id || 'primary',
        google_sync_direction: syncSettings.google_sync_direction || 'both',
        sync_keywords: syncSettings.sync_keywords || []
      });
    }
  }, [syncSettings]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (syncSettings?.id) {
        return base44.entities.CalendarSync.update(syncSettings.id, data);
      }
      return base44.entities.CalendarSync.create({ ...data, user_email: user.email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarSync'] });
    }
  });

  const loadGoogleCalendars = async () => {
    setLoadingCalendars(true);
    const response = await base44.functions.invoke('googleCalendarSync', { action: 'listCalendars' });
    setGoogleCalendars(response.data.calendars || []);
    setLoadingCalendars(false);
  };

  useEffect(() => {
    if (open && googleCalendars.length === 0) {
      loadGoogleCalendars();
    }
  }, [open]);

  const handleSyncNow = async (direction) => {
    setSyncing(true);
    setSyncResult(null);
    
    if (direction === 'from_google' || direction === 'both') {
      const response = await base44.functions.invoke('googleCalendarSync', {
        action: 'syncFromGoogle',
        calendarId: formData.google_calendar_id,
        eventData: { keywords: formData.sync_keywords }
      });
      setSyncResult({ type: 'success', message: `Imported ${response.data.imported} events from Google Calendar` });
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
    }
    
    // Update last sync time
    saveMutation.mutate({ ...formData, last_google_sync: new Date().toISOString() });
    setSyncing(false);
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.sync_keywords.includes(keywordInput.trim())) {
      setFormData(prev => ({
        ...prev,
        sync_keywords: [...prev.sync_keywords, keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword) => {
    setFormData(prev => ({
      ...prev,
      sync_keywords: prev.sync_keywords.filter(k => k !== keyword)
    }));
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const directionOptions = [
    { value: 'to_google', label: 'App → Google', icon: ArrowRight },
    { value: 'from_google', label: 'Google → App', icon: ArrowLeft },
    { value: 'both', label: 'Two-way sync', icon: ArrowLeftRight }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Calendar Sync Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Google Calendar Section */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png" className="w-8 h-8" alt="Google" />
                <div>
                  <h3 className="font-semibold">Google Calendar</h3>
                  <p className="text-xs text-gray-500">Connected</p>
                </div>
              </div>
              <Switch 
                checked={formData.google_enabled}
                onCheckedChange={(checked) => setFormData({...formData, google_enabled: checked})}
              />
            </div>

            {formData.google_enabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Calendar</label>
                  <Select 
                    value={formData.google_calendar_id} 
                    onValueChange={(v) => setFormData({...formData, google_calendar_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select calendar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingCalendars ? (
                        <div className="p-2 text-center text-sm text-gray-500">Loading...</div>
                      ) : (
                        googleCalendars.map(cal => (
                          <SelectItem key={cal.id} value={cal.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: cal.backgroundColor }}></div>
                              {cal.summary}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Sync Direction</label>
                  <Select 
                    value={formData.google_sync_direction} 
                    onValueChange={(v) => setFormData({...formData, google_sync_direction: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {directionOptions.map(opt => {
                        const Icon = opt.icon;
                        return (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {opt.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Filter Keywords (for importing)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Only import events containing these keywords. Leave empty to import all.
                  </p>
                  <div className="flex gap-2 mb-2">
                    <Input 
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      placeholder="e.g., wellness, workshop"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    />
                    <Button variant="outline" onClick={addKeyword}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.sync_keywords.map(kw => (
                      <Badge key={kw} variant="secondary" className="cursor-pointer" onClick={() => removeKeyword(kw)}>
                        {kw} <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>

                {syncSettings?.last_google_sync && (
                  <p className="text-xs text-gray-500">
                    Last synced: {new Date(syncSettings.last_google_sync).toLocaleString()}
                  </p>
                )}

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleSyncNow(formData.google_sync_direction)}
                  disabled={syncing}
                >
                  {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Sync Now
                </Button>
              </div>
            )}
          </div>

          {/* Outlook Section - Placeholder */}
          <div className="border rounded-lg p-4 opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg" className="w-8 h-8" alt="Outlook" />
                <div>
                  <h3 className="font-semibold">Outlook Calendar</h3>
                  <p className="text-xs text-gray-500">Coming soon</p>
                </div>
              </div>
              <Switch disabled />
            </div>
          </div>

          {/* Sync Result */}
          {syncResult && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              syncResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {syncResult.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {syncResult.message}
            </div>
          )}

          <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full bg-[#770142] hover:bg-[#5a0132]">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}