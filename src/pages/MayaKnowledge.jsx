import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, BookOpen, Clock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const CATEGORIES = [
  { value: 'sales_process', label: 'Sales Process' },
  { value: 'products', label: 'Products' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'platform_help', label: 'Platform Help' },
  { value: 'positioning', label: 'Positioning' },
];

const CATEGORY_COLORS = {
  sales_process: 'bg-blue-100 text-blue-700',
  products: 'bg-green-100 text-green-700',
  delivery: 'bg-purple-100 text-purple-700',
  platform_help: 'bg-gray-100 text-gray-700',
  positioning: 'bg-orange-100 text-orange-700',
};

function isStale(updatedDate) {
  if (!updatedDate) return false;
  return (Date.now() - new Date(updatedDate)) / 86400000 > 120;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MayaKnowledge() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.MayaKnowledge.list('-updated_date', 200);
      setEntries(data);
    } catch (e) {
      console.error('Failed to load knowledge entries:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing.id) {
        await base44.entities.MayaKnowledge.update(editing.id, {
          slug: editing.slug,
          title: editing.title,
          content: editing.content,
          category: editing.category,
          is_active: editing.is_active,
        });
      } else {
        await base44.entities.MayaKnowledge.create({
          slug: editing.slug,
          title: editing.title,
          content: editing.content,
          category: editing.category,
          is_active: editing.is_active ?? true,
        });
      }
      setEditing(null);
      await load();
    } catch (e) {
      alert('Failed to save: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (entry) => {
    try {
      await base44.entities.MayaKnowledge.update(entry.id, { is_active: !entry.is_active });
      await load();
    } catch (e) {
      console.error('Failed to toggle:', e);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Header */}
      <div className="bg-white border-b px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-brand-navy flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Maya Knowledge Base
              </h1>
              <p className="text-sm text-gray-500">Manage knowledge entries that inform Maya's briefings and insights</p>
            </div>
          </div>
          <Button onClick={() => setEditing({ slug: '', title: '', content: '', category: 'sales_process', is_active: true })}>
            <Plus className="w-4 h-4 mr-1" />
            New Entry
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-8">Loading...</p>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No knowledge entries yet. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          entries.map(entry => (
            <Card key={entry.id} className={!entry.is_active ? 'opacity-60' : ''}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800">{entry.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.platform_help}`}>
                      {CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}
                    </span>
                    {isStale(entry.updated_date) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Review suggested
                      </span>
                    )}
                    {!entry.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">/{entry.slug} · Updated {fmtDate(entry.updated_date)}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {entry.content ? entry.content.slice(0, 150) + (entry.content.length > 150 ? '…' : '') : 'No content'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={entry.is_active} onCheckedChange={() => toggleActive(entry)} />
                  <Button variant="ghost" size="icon" onClick={() => setEditing(entry)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing.id ? 'Edit Entry' : 'New Knowledge Entry'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Slug</Label>
                <Input
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  placeholder="e.g. sales-process-overview"
                  disabled={!!editing.id}
                />
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="e.g. Sales Process Overview"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Content (Markdown)</Label>
                <Textarea
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  placeholder="Write the knowledge content in markdown..."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !editing.slug || !editing.title || !editing.content}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}