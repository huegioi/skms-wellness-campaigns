import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, RefreshCw, Mail, UserPlus, UserMinus, Tag, MousePointerClick, FileText, ShoppingCart, Power } from 'lucide-react';
import { toast } from 'sonner';
import KajabiSyncProgress from './KajabiSyncProgress';

export default function EmailMarketingSection() {
  const [selectedTags, setSelectedTags] = useState([]);
  const [contactStartDate, setContactStartDate] = useState('');
  const [contactEndDate, setContactEndDate] = useState('');
  const [timePeriod, setTimePeriod] = useState('week');
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [hideOutliers, setHideOutliers] = useState(false);

  const { data: kajabiStats, isLoading: kajabiLoading, refetch: refetchKajabi } = useQuery({
    queryKey: ['kajabiStats'],
    queryFn: async () => {
      const response = await base44.functions.invoke('analyzeKajabiSheet');
      return response.data?.stats || null;
    },
    refetchInterval: 300000,
    initialData: null
  });

  const { data: kajabiContacts = [] } = useQuery({
    queryKey: ['kajabiContacts'],
    queryFn: () => base44.entities.KajabiContact.list('-last_synced'),
    initialData: []
  });

  React.useEffect(() => {
    base44.functions.invoke('listDailyKajabiSync')
      .then(res => {
        const automation = res.data?.[0];
        setAutoSyncEnabled(automation?.is_active || false);
      })
      .catch(() => setAutoSyncEnabled(false));
  }, []);

  const syncKajabiContacts = async () => {
    try {
      setIsSyncing(true);
      toast.loading('Syncing from Google Sheets...', { id: 'kajabi-sync' });
      const response = await base44.functions.invoke('appendNewKajabiContacts');
      await refetchKajabi();
      toast.success(response.data?.message || 'Contacts synced successfully!', { id: 'kajabi-sync' });
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync: ' + error.message, { id: 'kajabi-sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleAutoSync = async () => {
    try {
      const automations = await base44.functions.invoke('listDailyKajabiSync');
      const automation = automations.data?.[0];

      if (!automation) {
        await base44.functions.invoke('createDailyKajabiSync');
        setAutoSyncEnabled(true);
        toast.success('Auto-sync enabled - runs daily', { duration: 2000 });
      } else {
        const newState = !automation.is_active;
        await base44.functions.invoke('toggleDailyKajabiSync', { automation_id: automation.id, enabled: newState });
        setAutoSyncEnabled(newState);
        toast.success(newState ? 'Auto-sync enabled - runs daily' : 'Auto-sync disabled', { duration: 2000 });
      }
    } catch (error) {
      toast.error('Failed to toggle auto-sync: ' + error.message);
    }
  };

  const clearAllContacts = async () => {
    if (!confirm('Are you sure you want to PURGE ALL Kajabi contacts and sync data? This cannot be undone and will delete everything.')) {
      return;
    }

    try {
      setIsClearing(true);
      toast.loading('Purging all contacts...', { id: 'purge-contacts' });

      let completed = false;
      let totalDeleted = 0;

      while (!completed) {
        const response = await base44.functions.invoke('purgeKajabiData');
        const data = response.data;

        if (data.completed) {
          completed = true;
          toast.success(data.message || 'Successfully purged all contacts!', { id: 'purge-contacts' });
        } else {
          totalDeleted += data.totalContactsDeleted || 0;
          toast.loading(`Deleted ${totalDeleted} contacts so far...`, { id: 'purge-contacts' });
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      await refetchKajabi();
    } catch (error) {
      console.error('Purge failed:', error);
      toast.error('Failed to purge contacts: ' + error.message, { id: 'purge-contacts' });
    } finally {
      setIsClearing(false);
    }
  };

  // Calculate Kajabi contact growth trends with filters
  const kajabiTrendData = useMemo(() => {
    if (!kajabiContacts.length) return [];

    const filteredContacts = kajabiContacts.filter((contact) => {
      const createdDate = new Date(contact.kajabi_created_at);
      const start = contactStartDate ? new Date(contactStartDate) : null;
      const end = contactEndDate ? new Date(contactEndDate) : null;

      if (start && createdDate < start) return false;
      if (end && createdDate > end) return false;
      return true;
    });

    const buckets = {};

    filteredContacts.forEach((contact) => {
      const createdDate = new Date(contact.kajabi_created_at);
      let key, label;

      if (timePeriod === 'day') {
        key = createdDate.toISOString().split('T')[0];
        label = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (timePeriod === 'week') {
        const weekStart = new Date(createdDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = weekStart.toISOString().split('T')[0];
        label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        key = createdDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        label = key;
      }

      if (!buckets[key]) {
        buckets[key] = { key, label, subscribed: 0, unsubscribed: 0, total: 0 };
      }
      buckets[key].total++;
      if (contact.subscribed) buckets[key].subscribed++; else
        buckets[key].unsubscribed++;
    });

    return Object.values(buckets).
      sort((a, b) => new Date(a.key) - new Date(b.key));
  }, [kajabiContacts, contactStartDate, contactEndDate, timePeriod]);

  // Filter outliers from trend data (values > 2 std deviations from mean)
  const kajabiTrendDataFiltered = useMemo(() => {
    if (!hideOutliers || kajabiTrendData.length === 0) return kajabiTrendData;
    const totals = kajabiTrendData.map(d => d.total);
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const stdDev = Math.sqrt(totals.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / totals.length);
    return kajabiTrendData.filter(d => Math.abs(d.total - mean) <= 2 * stdDev);
  }, [kajabiTrendData, hideOutliers]);

  // Tag tracking
  const tagData = useMemo(() => {
    if (!kajabiContacts.length) return [];

    const tagCounts = {};
    kajabiContacts.forEach((contact) => {
      (contact.tags || []).forEach((tag) => {
        if (!tagCounts[tag]) {
          tagCounts[tag] = { name: tag, subscribed: 0, unsubscribed: 0, total: 0 };
        }
        tagCounts[tag].total++;
        if (contact.subscribed) tagCounts[tag].subscribed++; else
          tagCounts[tag].unsubscribed++;
      });
    });

    return Object.values(tagCounts).sort((a, b) => b.total - a.total);
  }, [kajabiContacts]);

  const filteredTagData = selectedTags.length > 0 ?
    tagData.filter((t) => selectedTags.includes(t.name)) :
    tagData.slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: '#264d44' }}>Email Marketing (Kajabi)</h2>
      </div>

      {/* Sync Progress Dashboard */}
      <KajabiSyncProgress />

      <div className="flex items-center justify-between pt-4">
        <h3 className="text-xl font-semibold" style={{ color: '#264d44' }}>Contact Analytics</h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={toggleAutoSync}
            variant="outline"
            className={`transition-all ${autoSyncEnabled ? 'bg-green-50 border-green-600 text-green-700 hover:bg-green-100' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
            <Power className={`w-4 h-4 mr-2 transition-colors ${autoSyncEnabled ? 'text-green-600' : 'text-gray-400'}`} />
            {autoSyncEnabled ? 'Auto-Sync ON' : 'Auto-Sync OFF'}
          </Button>
          <Button
            onClick={clearAllContacts}
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
            disabled={isClearing || kajabiLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isClearing ? 'animate-spin' : ''}`} />
            {isClearing ? 'Purging...' : 'Purge All Data'}
          </Button>
          <Button
            onClick={syncKajabiContacts}
            variant="outline"
            className="border-[#264d44] text-[#264d44] hover:bg-[#264d44] hover:text-white"
            disabled={isSyncing || kajabiLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Kajabi'}
          </Button>
        </div>
      </div>

      {kajabiStats ?
        <>
          {/* Kajabi Contact KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-6 z-10 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Total Contacts</p>
                    <p className="text-3xl font-bold text-blue-600">{kajabiStats.total}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100 transition-all duration-300 group-hover:scale-110">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute inset-0 opacity-5 bg-blue-100 group-hover:opacity-10 transition-opacity"></div>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-6 z-10 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Subscribed</p>
                    <p className="text-3xl font-bold text-green-600">{kajabiStats.subscribed}</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100 transition-all duration-300 group-hover:scale-110">
                    <Mail className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute inset-0 opacity-5 bg-green-100 group-hover:opacity-10 transition-opacity"></div>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-6 z-10 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">New (30 days)</p>
                    <p className="text-3xl font-bold text-purple-600">{kajabiStats.newLast30Days}</p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-100 transition-all duration-300 group-hover:scale-110">
                    <UserPlus className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute inset-0 opacity-5 bg-purple-100 group-hover:opacity-10 transition-opacity"></div>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-6 z-10 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Unsubscribed</p>
                    <p className="text-3xl font-bold text-red-600">{kajabiStats.unsubscribed}</p>
                  </div>
                  <div className="p-3 rounded-full bg-red-100 transition-all duration-300 group-hover:scale-110">
                    <UserMinus className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute inset-0 opacity-5 bg-red-100 group-hover:opacity-10 transition-opacity"></div>
            </Card>
          </div>

          {/* Engagement Metrics (Webhook-based) */}
          {kajabiStats.engagement &&
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-6 z-10 relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Total Events (30d)</p>
                        <p className="text-3xl font-bold text-indigo-600">{kajabiStats.engagement.totalEvents}</p>
                      </div>
                      <div className="p-3 rounded-full bg-indigo-100 transition-all duration-300 group-hover:scale-110">
                        <MousePointerClick className="w-6 h-6 text-indigo-600" />
                      </div>
                    </div>
                  </CardContent>
                  <div className="absolute inset-0 opacity-5 bg-indigo-100 group-hover:opacity-10 transition-opacity"></div>
                </Card>

                <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-6 z-10 relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Form Submissions</p>
                        <p className="text-3xl font-bold text-cyan-600">{kajabiStats.engagement.formSubmissions}</p>
                      </div>
                      <div className="p-3 rounded-full bg-cyan-100 transition-all duration-300 group-hover:scale-110">
                        <FileText className="w-6 h-6 text-cyan-600" />
                      </div>
                    </div>
                  </CardContent>
                  <div className="absolute inset-0 opacity-5 bg-cyan-100 group-hover:opacity-10 transition-opacity"></div>
                </Card>

                <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-6 z-10 relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Tag Actions</p>
                        <p className="text-3xl font-bold text-amber-600">{kajabiStats.engagement.tagEngagements}</p>
                      </div>
                      <div className="p-3 rounded-full bg-amber-100 transition-all duration-300 group-hover:scale-110">
                        <Tag className="w-6 h-6 text-amber-600" />
                      </div>
                    </div>
                  </CardContent>
                  <div className="absolute inset-0 opacity-5 bg-amber-100 group-hover:opacity-10 transition-opacity"></div>
                </Card>

                <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-6 z-10 relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Conversions</p>
                        <p className="text-3xl font-bold text-emerald-600">{kajabiStats.engagement.conversions}</p>
                      </div>
                      <div className="p-3 rounded-full bg-emerald-100 transition-all duration-300 group-hover:scale-110">
                        <ShoppingCart className="w-6 h-6 text-emerald-600" />
                      </div>
                    </div>
                  </CardContent>
                  <div className="absolute inset-0 opacity-5 bg-emerald-100 group-hover:opacity-10 transition-opacity"></div>
                </Card>
              </div>

              {/* Event Activity Chart */}
              {kajabiStats.engagement.topEvents && kajabiStats.engagement.topEvents.length > 0 &&
                <Card className="hover:shadow-lg transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle style={{ color: '#264d44' }}>Top Engagement Events (Last 30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={kajabiStats.engagement.topEvents} margin={{ top: 5, right: 30, left: 20, bottom: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" name="Events" fill="#770142" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              }
            </>
          }

          {/* Top Tags Chart */}
          {kajabiStats.topTags && kajabiStats.topTags.length > 0 &&
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle style={{ color: '#264d44' }}>Top Contact Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={kajabiStats.topTags} margin={{ top: 5, right: 30, left: 20, bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" name="Contacts" fill="#264d44" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          }

          {/* Contact Growth Charts */}
          {kajabiContacts.length > 0 &&
            <>
              {/* Contact Growth Filters */}
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Start Date</label>
                      <Input
                        type="date"
                        value={contactStartDate}
                        onChange={(e) => setContactStartDate(e.target.value)}
                        className="w-full" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">End Date</label>
                      <Input
                        type="date"
                        value={contactEndDate}
                        onChange={(e) => setContactEndDate(e.target.value)}
                        className="w-full" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Time Period</label>
                      <Select value={timePeriod} onValueChange={setTimePeriod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Daily</SelectItem>
                          <SelectItem value="week">Weekly</SelectItem>
                          <SelectItem value="month">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Growth Chart */}
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle style={{ color: '#264d44' }}>
                      Contact Growth ({timePeriod === 'day' ? 'Daily' : timePeriod === 'week' ? 'Weekly' : 'Monthly'})
                    </CardTitle>
                    {timePeriod === 'week' && (
                      <button
                        onClick={() => setHideOutliers(!hideOutliers)}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                          hideOutliers
                            ? 'bg-[#264d44] text-white border-[#264d44]'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-[#264d44] hover:text-[#264d44]'
                        }`}
                      >
                        {hideOutliers ? 'Outliers Hidden' : 'Hide Outliers'}
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {kajabiTrendDataFiltered.length > 0 ?
                    <ResponsiveContainer width="100%" height={350}>
                      {timePeriod === 'day' || timePeriod === 'week' ?
                        <BarChart data={kajabiTrendDataFiltered} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="subscribed" name="Subscribed" stackId="a" fill="#22C55E" />
                          <Bar dataKey="unsubscribed" name="Unsubscribed" stackId="a" fill="#EF4444" />
                        </BarChart> :
                        <LineChart data={kajabiTrendDataFiltered} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="subscribed" name="Subscribed" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E' }} />
                          <Line type="monotone" dataKey="unsubscribed" name="Unsubscribed" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444' }} />
                          <Line type="monotone" dataKey="total" name="Total" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
                        </LineChart>
                      }
                    </ResponsiveContainer> :
                    <div className="h-[350px] flex items-center justify-center text-gray-400">No data in selected range</div>
                  }
                </CardContent>
              </Card>

              {/* Tag Performance */}
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle style={{ color: '#264d44' }}>Tag Performance</CardTitle>
                    {tagData.length > 10 &&
                      <Select
                        value={selectedTags.length > 0 ? selectedTags.join(',') : 'top10'}
                        onValueChange={(value) => {
                          if (value === 'top10') {
                            setSelectedTags([]);
                          } else {
                            setSelectedTags(value.split(','));
                          }
                        }}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select tags" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top10">Top 10 Tags</SelectItem>
                          {tagData.slice(0, 20).map((tag) =>
                            <SelectItem key={tag.name} value={tag.name}>{tag.name}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    }
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredTagData.length > 0 ?
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={filteredTagData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={150} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="subscribed" name="Subscribed" fill="#22C55E" />
                        <Bar dataKey="unsubscribed" name="Unsubscribed" fill="#EF4444" />
                      </BarChart>
                    </ResponsiveContainer> :
                    <div className="h-[300px] flex items-center justify-center text-gray-400">No tags yet</div>
                  }
                </CardContent>
              </Card>
            </>
          }
        </> :
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No Kajabi data available yet</p>
            <Button onClick={syncKajabiContacts} className="bg-[#264d44] hover:bg-[#1a3830]">
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Kajabi Contacts
            </Button>
          </CardContent>
        </Card>
      }
    </div>
  );
}