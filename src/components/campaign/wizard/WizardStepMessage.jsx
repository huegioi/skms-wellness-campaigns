import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import CtaLibrarySection from '@/components/campaign/wizard/CtaLibrarySection';

function htmlToPlainText(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function plainTextToHtml(text) {
  if (!text) return '';
  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export default function WizardStepMessage({ form, updateForm }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['email_templates'],
    queryFn: () => base44.entities.EmailTemplate.list('-created_date', 100),
  });

  const filteredTemplates = templates.filter(t =>
    (t.service_name || '').toLowerCase().includes(templateSearch.toLowerCase()) ||
    (t.subject || '').toLowerCase().includes(templateSearch.toLowerCase())
  );

  const loadTemplate = (template) => {
    updateForm('subject_template', template.subject || '');
    updateForm('body_template', htmlToPlainText(template.body || ''));
    updateForm('template_source_id', template.id);
    setPopoverOpen(false);
    toast.success('Template loaded');
  };

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.EmailTemplate.create({
      service_name: form.name || 'Outreach Campaign',
      template_type: 'follow_up',
      subject: form.subject_template,
      body: plainTextToHtml(form.body_template),
      tags: ['outreach-campaign'],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_templates'] });
      toast.success('Saved as template');
    },
    onError: () => toast.error('Failed to save template'),
  });

  return (
    <div className="space-y-4">
      {/* Template actions */}
      <div className="flex items-center gap-2">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Load from template
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <div className="flex items-center gap-2 border-b pb-2 mb-2">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <Input
                placeholder="Search templates..."
                className="h-8 border-0 p-0 focus-visible:ring-0"
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
              />
            </div>
            <div className="space-y-0.5 max-h-56 overflow-y-auto">
              {filteredTemplates.length === 0 ? (
                <p className="text-xs text-gray-400 p-2 text-center">No templates found</p>
              ) : filteredTemplates.map(t => (
                <div
                  key={t.id}
                  className="p-2 rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => loadTemplate(t)}
                >
                  <p className="text-sm font-medium text-gray-800 truncate">{t.subject || '(no subject)'}</p>
                  <p className="text-xs text-gray-500 truncate">{t.service_name}</p>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!form.subject_template || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          <Save className="w-3.5 h-3.5" /> Save as template
        </Button>

        {form.template_source_id && (
          <span className="text-xs text-gray-400">Loaded from template</span>
        )}
      </div>

      {/* Subject */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1 block">Subject Template *</Label>
        <Input
          placeholder="e.g., Following up, {{first_name}}"
          value={form.subject_template}
          onChange={e => updateForm('subject_template', e.target.value)}
        />
      </div>

      {/* Body */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1 block">Body Template *</Label>
        <Textarea
          rows={6}
          placeholder="Hi {{first_name}},&#10;&#10;[PERSONALIZE: reference your last conversation]&#10;&#10;Best,&#10;William"
          value={form.body_template}
          onChange={e => updateForm('body_template', e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-1">
          Use <code className="bg-gray-100 px-1 rounded">{'{{first_name}}'}</code> and <code className="bg-gray-100 px-1 rounded">{'{{company}}'}</code> for merge fields.
          Use <code className="bg-gray-100 px-1 rounded">[PERSONALIZE: ...]</code> for guidance Maya will fill in.
        </p>
      </div>

      {/* Personalization notes */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1 block">Personalization Notes</Label>
        <Textarea
          rows={3}
          placeholder="Tell Maya about this campaign - e.g., 'we met most of these people at the SHRM conference last week; keep it warm and brief'"
          value={form.personalization_notes}
          onChange={e => updateForm('personalization_notes', e.target.value)}
        />
      </div>

      {/* Calls to action */}
      <CtaLibrarySection onSelectedCtasChange={(snapshot) => updateForm('selected_ctas', snapshot)} />
    </div>
  );
}