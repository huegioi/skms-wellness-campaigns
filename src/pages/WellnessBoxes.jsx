import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { 
  Gift, Sparkles, Award, Target, Users, Heart, Brain, 
  Zap, CheckCircle, Send, Loader2 
} from 'lucide-react';

export default function WellnessBoxes() {
  const [builderForm, setBuilderForm] = useState({
    budget: '',
    theme: '',
    preferences: '',
    quantity: '',
    purpose: '',
    contactName: '',
    contactEmail: '',
    notes: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSuggestions, setGeneratedSuggestions] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const boxOptions = [
    {
      id: 'physical',
      name: 'Custom Wellness Boxes (Physical)',
      priceRange: '$40-$100',
      description: 'Custom-curated physical gift boxes delivered to your team. Perfect for tangible appreciation.',
      themes: ['Mental Health/Stress Relief', 'Gratitude', 'New Year New You', 'Self-Care', 'Relaxation'],
      icon: Gift,
      color: 'from-purple-500 to-pink-500',
      image: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=800'
    },
    {
      id: 'digital',
      name: 'Digital Wellness Boxes',
      priceRange: '$50-$75',
      description: 'Global incentive solution with digital gift cards plus curated wellness content. Ideal for remote teams.',
      themes: ['Mental Health/Stress Relief', 'Mindfulness', 'Emotional Resilience', 'Work-Life Balance'],
      icon: Sparkles,
      color: 'from-blue-500 to-cyan-500',
      image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800'
    }
  ];

  const incentiveUses = [
    {
      title: 'Workshop Attendance Incentive',
      description: 'Reward employees who attend wellness workshops with themed boxes that reinforce the workshop content.',
      icon: Users,
      color: 'bg-blue-50 border-blue-200'
    },
    {
      title: 'Challenge Completion Prizes',
      description: 'Celebrate employees who complete wellness challenges (14-day programs) with meaningful prizes.',
      icon: Award,
      color: 'bg-green-50 border-green-200'
    },
    {
      title: 'Monthly Recognition',
      description: 'Recognize outstanding team members or milestones with curated wellness boxes.',
      icon: Target,
      color: 'bg-purple-50 border-purple-200'
    },
    {
      title: 'Onboarding Gifts',
      description: 'Welcome new employees with a wellness box that sets the tone for your company culture.',
      icon: Heart,
      color: 'bg-pink-50 border-pink-200'
    }
  ];

  const generateSuggestions = async () => {
    if (!builderForm.budget || !builderForm.theme) {
      alert('Please fill in at least Budget and Theme to generate suggestions.');
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = `Create a detailed wellness box suggestion with the following criteria:
- Budget: ${builderForm.budget}
- Theme: ${builderForm.theme}
- Preferences: ${builderForm.preferences || 'None specified'}
- Purpose: ${builderForm.purpose || 'General wellness'}

Please suggest 5-8 specific items to include in this wellness box, with estimated costs and brief descriptions. 
Format as an array of items with name, description, and estimated_cost fields.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            box_name: { type: 'string' },
            total_estimated_cost: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  estimated_cost: { type: 'number' }
                }
              }
            },
            rationale: { type: 'string' }
          }
        }
      });

      setGeneratedSuggestions(response);
    } catch (error) {
      alert('Failed to generate suggestions. Please try again.');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendRequest = async () => {
    if (!builderForm.contactName || !builderForm.contactEmail) {
      alert('Please provide your name and email.');
      return;
    }

    setIsSending(true);
    try {
      const emailBody = `
        <h2>Custom Wellness Box Request</h2>
        
        <h3>Contact Information</h3>
        <p><strong>Name:</strong> ${builderForm.contactName}</p>
        <p><strong>Email:</strong> ${builderForm.contactEmail}</p>
        
        <h3>Box Specifications</h3>
        <p><strong>Budget:</strong> ${builderForm.budget}</p>
        <p><strong>Theme:</strong> ${builderForm.theme}</p>
        <p><strong>Quantity:</strong> ${builderForm.quantity || 'Not specified'}</p>
        <p><strong>Purpose:</strong> ${builderForm.purpose || 'Not specified'}</p>
        <p><strong>Preferences:</strong> ${builderForm.preferences || 'None specified'}</p>
        <p><strong>Additional Notes:</strong> ${builderForm.notes || 'None'}</p>
        
        ${generatedSuggestions ? `
          <h3>AI-Generated Suggestions</h3>
          <p><strong>Box Name:</strong> ${generatedSuggestions.box_name}</p>
          <p><strong>Estimated Total:</strong> $${generatedSuggestions.total_estimated_cost}</p>
          <p><strong>Rationale:</strong> ${generatedSuggestions.rationale}</p>
          
          <h4>Suggested Items:</h4>
          <ul>
            ${generatedSuggestions.items.map(item => `
              <li><strong>${item.name}</strong> ($${item.estimated_cost}): ${item.description}</li>
            `).join('')}
          </ul>
        ` : ''}
      `;

      await base44.integrations.Core.SendEmail({
        to: 'admin@skillfulmeans.life',
        subject: `Custom Wellness Box Request - ${builderForm.contactName}`,
        body: emailBody
      });

      alert('Request sent successfully! We\'ll be in touch soon.');
      setBuilderForm({
        budget: '',
        theme: '',
        preferences: '',
        quantity: '',
        purpose: '',
        contactName: '',
        contactEmail: '',
        notes: ''
      });
      setGeneratedSuggestions(null);
    } catch (error) {
      alert('Failed to send request. Please try again.');
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <Gift className="w-16 h-16 mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Wellness Boxes</h1>
          <p className="text-xl md:text-2xl mb-6 opacity-95">
            Curated wellness gifts that inspire, motivate, and reward your team
          </p>
          <p className="text-lg opacity-90 max-w-3xl mx-auto">
            From workshop incentives to challenge prizes, our wellness boxes create meaningful moments 
            that reinforce your company's commitment to employee well-being
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Existing Wellness Box Options */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-[#013f7c] mb-8">Our Wellness Box Options</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {boxOptions.map((box) => {
              const Icon = box.icon;
              return (
                <Card key={box.id} className="overflow-hidden">
                  <div className={`h-48 bg-gradient-to-br ${box.color} relative`}>
                    <img 
                      src={box.image} 
                      alt={box.name}
                      className="w-full h-full object-cover opacity-50"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Icon className="w-20 h-20 text-white" />
                    </div>
                  </div>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle>{box.name}</CardTitle>
                      <Badge variant="outline" className="text-lg">{box.priceRange}</Badge>
                    </div>
                    <CardDescription className="text-base">{box.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Available Themes:</p>
                      <div className="flex flex-wrap gap-2">
                        {box.themes.map((theme, idx) => (
                          <Badge key={idx} variant="secondary">{theme}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Why Wellness Boxes Section */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[#013f7c] mb-4">Why Wellness Boxes?</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Wellness boxes are more than gifts—they're powerful tools for engagement, 
              motivation, and building a culture of well-being
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {incentiveUses.map((use, idx) => {
              const Icon = use.icon;
              return (
                <Card key={idx} className={`border-2 ${use.color}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-white">
                        <Icon className="w-6 h-6 text-[#264d44]" />
                      </div>
                      <CardTitle className="text-xl">{use.title}</CardTitle>
                    </div>
                    <CardDescription className="text-base">{use.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Custom Box Builder */}
        <section className="mb-16">
          <Card className="border-2 border-[#264d44]">
            <CardHeader className="bg-gradient-to-r from-[#264d44] to-[#013f7c] text-white">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Zap className="w-6 h-6" />
                Custom Wellness Box Builder
              </CardTitle>
              <CardDescription className="text-white/90">
                Tell us what you're looking for, and we'll help you create the perfect wellness box
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Budget per Box *</label>
                  <Select value={builderForm.budget} onValueChange={(v) => setBuilderForm({...builderForm, budget: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select budget range..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="$25-$50">$25-$50</SelectItem>
                      <SelectItem value="$50-$75">$50-$75</SelectItem>
                      <SelectItem value="$75-$100">$75-$100</SelectItem>
                      <SelectItem value="$100-$150">$100-$150</SelectItem>
                      <SelectItem value="$150+">$150+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Theme *</label>
                  <Select value={builderForm.theme} onValueChange={(v) => setBuilderForm({...builderForm, theme: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mental Health/Stress Relief">Mental Health/Stress Relief</SelectItem>
                      <SelectItem value="Gratitude">Gratitude</SelectItem>
                      <SelectItem value="Self-Care">Self-Care</SelectItem>
                      <SelectItem value="Mindfulness">Mindfulness</SelectItem>
                      <SelectItem value="Emotional Resilience">Emotional Resilience</SelectItem>
                      <SelectItem value="Work-Life Balance">Work-Life Balance</SelectItem>
                      <SelectItem value="New Year New You">New Year New You</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity Needed</label>
                  <Input 
                    type="number" 
                    placeholder="How many boxes?" 
                    value={builderForm.quantity}
                    onChange={(e) => setBuilderForm({...builderForm, quantity: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Purpose</label>
                  <Select value={builderForm.purpose} onValueChange={(v) => setBuilderForm({...builderForm, purpose: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="What's this for?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Workshop Attendance Incentive">Workshop Attendance Incentive</SelectItem>
                      <SelectItem value="Challenge Completion Prize">Challenge Completion Prize</SelectItem>
                      <SelectItem value="Monthly Recognition">Monthly Recognition</SelectItem>
                      <SelectItem value="Onboarding Gift">Onboarding Gift</SelectItem>
                      <SelectItem value="Holiday Gift">Holiday Gift</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Item Preferences</label>
                <Textarea 
                  placeholder="Any specific items or types you'd like included? (e.g., snacks, self-care products, stationery, tech accessories)"
                  value={builderForm.preferences}
                  onChange={(e) => setBuilderForm({...builderForm, preferences: e.target.value})}
                  rows={3}
                />
              </div>

              <Button 
                onClick={generateSuggestions}
                disabled={isGenerating || !builderForm.budget || !builderForm.theme}
                className="w-full bg-[#770142] hover:bg-[#5a0132]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Suggestions...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Generate AI-Powered Suggestions
                  </>
                )}
              </Button>

              {/* Generated Suggestions */}
              {generatedSuggestions && (
                <div className="mt-6 p-6 bg-green-50 border-2 border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <h3 className="text-xl font-bold text-green-900">{generatedSuggestions.box_name}</h3>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-4">{generatedSuggestions.rationale}</p>
                  
                  <div className="space-y-3 mb-4">
                    {generatedSuggestions.items.map((item, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-green-200">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-semibold text-gray-800">{item.name}</p>
                          <Badge>${item.estimated_cost}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-900">
                      Estimated Total: ${generatedSuggestions.total_estimated_cost}
                    </p>
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Your Name *</label>
                    <Input 
                      placeholder="Name" 
                      value={builderForm.contactName}
                      onChange={(e) => setBuilderForm({...builderForm, contactName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Your Email *</label>
                    <Input 
                      type="email"
                      placeholder="Email" 
                      value={builderForm.contactEmail}
                      onChange={(e) => setBuilderForm({...builderForm, contactEmail: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Additional Notes</label>
                  <Textarea 
                    placeholder="Any other details we should know?"
                    value={builderForm.notes}
                    onChange={(e) => setBuilderForm({...builderForm, notes: e.target.value})}
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleSendRequest}
                  disabled={isSending || !builderForm.contactName || !builderForm.contactEmail}
                  className="w-full mt-4 bg-[#264d44] hover:bg-[#1a3830]"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Custom Box Request
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA Section */}
        <section className="text-center bg-gradient-to-br from-[#264d44] to-[#013f7c] text-white rounded-xl p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Boost Engagement?</h2>
          <p className="text-xl mb-8 opacity-95">
            Let's create wellness boxes that make a real impact on your team
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="bg-white text-[#264d44] hover:bg-gray-100">
              Request a Quote
            </Button>
            <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10">
              View Catalog
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}