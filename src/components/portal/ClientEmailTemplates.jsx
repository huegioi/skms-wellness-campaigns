import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Mail, Download, FileText, Award, Dumbbell, Users, Package } from 'lucide-react';
import { productCatalog } from '@/components/curriculum/catalogData';

export default function ClientEmailTemplates({ proposal }) {
  const { data: templates = [] } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => base44.entities.EmailTemplate.list('service_category')
  });

  const selections = proposal?.selections || {};

  // Get all services included in the proposal
  const getProposalServices = () => {
    const services = [];
    
    selections.workshops?.forEach(key => {
      const workshop = productCatalog.workshops[key];
      if (workshop) services.push({ key, name: workshop.name, category: 'workshop' });
    });
    
    selections.challengePrograms?.forEach(key => {
      const challenge = productCatalog.challenges[key];
      if (challenge) services.push({ key, name: challenge.name, category: 'challenge' });
    });
    
    selections.leadership?.forEach(key => {
      const program = productCatalog.leadership[key];
      if (program) services.push({ key, name: program.name, category: 'leadership' });
    });
    
    selections.movementClasses?.forEach(key => {
      const classItem = productCatalog.movementClasses[key];
      if (classItem) services.push({ key, name: classItem.name, category: 'class' });
    });

    return services;
  };

  const proposalServices = getProposalServices();

  const categoryIcons = {
    workshop: Award,
    challenge: Dumbbell,
    leadership: Users,
    class: Dumbbell,
    wellness_box: Package
  };

  const categoryColors = {
    workshop: '#264d44',
    challenge: '#ff9878',
    leadership: '#770142',
    class: '#013f7c',
    wellness_box: '#eaf995'
  };

  const templateTypeLabels = {
    announcement: 'Announcement (2 weeks before)',
    reminder_2weeks: '2-Week Reminder',
    reminder_2days: '2-Day Reminder',
    follow_up: 'Post-Event Follow-up'
  };

  const handleDownload = (template) => {
    const content = `Subject: ${template.subject}\n\n${template.body?.replace(/<[^>]*>/g, '') || 'Template content'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = template.file_url || url;
    a.download = `${template.service_name.replace(/\s+/g, '-')}-${template.template_type}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Group templates by service
  const getTemplatesForService = (serviceName) => {
    return templates.filter(t => 
      t.service_name?.toLowerCase() === serviceName?.toLowerCase()
    );
  };

  if (!proposal) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Email Templates Available</h3>
          <p className="text-gray-500">Email templates will be available once your proposal is accepted.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card className="border-l-4" style={{ borderLeftColor: '#013f7c' }}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Mail className="w-6 h-6 text-[#013f7c] mt-1" />
            <div>
              <h3 className="font-semibold text-lg text-gray-800 mb-2">Email Templates for Your Program</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Below are the email templates for each service in your wellness program. 
                Use these to communicate with your employees about upcoming events. 
                Templates include announcement emails (send 2 weeks before), reminder emails (send 2 days before), 
                and follow-up emails (send after the event).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Templates */}
      {proposalServices.length > 0 ? (
        <Accordion type="single" collapsible className="space-y-4">
          {proposalServices.map(service => {
            const serviceTemplates = getTemplatesForService(service.name);
            const Icon = categoryIcons[service.category] || FileText;
            const color = categoryColors[service.category] || '#666';

            return (
              <AccordionItem 
                key={service.key} 
                value={service.key}
                className="bg-white rounded-lg border shadow-sm overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-semibold text-gray-800">{service.name}</h4>
                      <p className="text-sm text-gray-500">
                        {serviceTemplates.length > 0 
                          ? `${serviceTemplates.length} template(s) available`
                          : 'No templates uploaded yet'
                        }
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {serviceTemplates.length > 0 ? (
                    <div className="space-y-3 mt-2">
                      {serviceTemplates.map(template => (
                        <div 
                          key={template.id} 
                          className="border rounded-lg p-4 bg-gray-50"
                        >
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">
                                  {templateTypeLabels[template.template_type] || template.template_type}
                                </Badge>
                              </div>
                              <p className="font-medium text-gray-800">{template.subject}</p>
                              {template.body && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                  {template.body.replace(/<[^>]*>/g, '').substring(0, 150)}...
                                </p>
                              )}
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDownload(template)}
                              className="shrink-0"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Templates for this service will be uploaded soon.</p>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No services found in your proposal.</p>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      <Card className="bg-[#264d44]/5 border-[#264d44]/20">
        <CardContent className="pt-6">
          <h4 className="font-semibold text-[#264d44] mb-2">Need Custom Templates?</h4>
          <p className="text-gray-600 text-sm">
            Contact us at <a href="mailto:admin@skillfulmeans.life" className="text-[#770142] underline">admin@skillfulmeans.life</a> if you need customized email templates or have any questions about communicating with your employees.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}