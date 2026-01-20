import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Mail, Download, FileText, Award, Dumbbell, Users, Package, Eye } from 'lucide-react';
import { productCatalog } from '@/components/curriculum/catalogData';

export default function ClientEmailTemplates({ proposal, templates = [], client }) {
  const [viewingTemplate, setViewingTemplate] = useState(null);

  const selections = proposal?.selections || {};
  
  // Filter templates based on client's manual selection if available
  const availableTemplates = client?.portal_template_ids?.length > 0
    ? templates.filter(t => client.portal_template_ids.includes(t.id))
    : templates;

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

  const handleDownload = async (template, format = 'eml') => {
    let content, blob, fileName, mimeType;
    const sanitizedName = `${template.service_name.replace(/\s+/g, '-')}-${template.template_type}`;

    if (format === 'eml') {
      // Create .eml format (email file)
      content = `Subject: ${template.subject}\r\n`;
      content += `From: noreply@skillfulmeans.life\r\n`;
      content += `To: \r\n`;
      content += `Content-Type: text/html; charset=UTF-8\r\n`;
      content += `\r\n`;
      content += template.body || '';
      
      blob = new Blob([content], { type: 'message/rfc822' });
      fileName = `${sanitizedName}.eml`;
    } else if (format === 'doc') {
      // Create HTML document that opens in Word
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${template.subject}</title>
</head>
<body>
  <h2>Subject: ${template.subject}</h2>
  <hr>
  ${template.body || ''}
</body>
</html>`;
      
      blob = new Blob([htmlContent], { type: 'application/msword' });
      fileName = `${sanitizedName}.doc`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Group templates by service
  const getTemplatesForService = (serviceName) => {
    return availableTemplates.filter(t => 
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
      {/* Custom Documents */}
      {client?.portal_documents?.length > 0 && (
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Custom Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {client.portal_documents.map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium">{doc.name}</p>
                    {doc.description && (
                      <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(doc.file_url, '_blank')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Open
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                            <div className="flex gap-2 shrink-0 flex-wrap">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setViewingTemplate(template)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDownload(template, 'eml')}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                .EML
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDownload(template, 'doc')}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                .DOC
                              </Button>
                            </div>
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

      {/* View Template Dialog */}
      <Dialog open={!!viewingTemplate} onOpenChange={(open) => !open && setViewingTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Template</DialogTitle>
          </DialogHeader>
          {viewingTemplate && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Service</label>
                  <p className="text-gray-900">{viewingTemplate.service_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Template Type</label>
                  <p className="text-gray-900">{templateTypeLabels[viewingTemplate.template_type]}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Subject Line</label>
                <p className="text-gray-900 font-medium">{viewingTemplate.subject}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Email Body</label>
                <div 
                  className="border rounded-lg p-4 bg-gray-50 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: viewingTemplate.body || '<span class="text-gray-400 italic">No body content</span>' }}
                />
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => handleDownload(viewingTemplate, 'eml')}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" /> Download as .EML
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleDownload(viewingTemplate, 'doc')}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" /> Download as .DOC
                </Button>
                <Button onClick={() => setViewingTemplate(null)} className="flex-1 bg-[#264d44] hover:bg-[#1a3830]">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}