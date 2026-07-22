import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarPlus, ExternalLink, Sparkles } from 'lucide-react';

const CALENDLY_LINK = 'https://calendly.com/d/cksd-9yr-nfc/skillfulmeans-strategy-session';

export default function BookSession({ client }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3 text-brand-navy">
            <CalendarPlus className="w-7 h-7" />
            Book a New Service
          </CardTitle>
          <p className="text-gray-500 text-sm mt-1">
            Ready to add more wellness programming? Use the button below to schedule a discovery call or book a new service with our team.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="py-10">
          <div className="max-w-lg mx-auto text-center space-y-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: '#264d4420' }}>
              <Sparkles className="w-10 h-10 text-brand-green" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Schedule Your Next Wellness Session</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Choose a time that works best for you and your team. We offer workshops, 14-day challenges, leadership programs, movement classes, and more.
              </p>
            </div>

            <a
              href={CALENDLY_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button
                size="lg"
                className="text-white font-semibold px-8 py-3 text-base gap-2 bg-brand-plum"
              >
                <CalendarPlus className="w-5 h-5" />
                Book a Session
                <ExternalLink className="w-4 h-4 ml-1" />
              </Button>
            </a>

            <p className="text-xs text-gray-400">
              You'll be taken to our Calendly page to select a date and time.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* What's available */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-brand-green">What We Offer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Workshops', desc: 'Interactive sessions to build mental fitness skills', emoji: '🧠' },
              { title: '14-Day Challenges', desc: 'Engaging team challenges to reinforce healthy habits', emoji: '🏆' },
              { title: 'Leadership Programs', desc: 'Emotional intelligence training for managers', emoji: '🌱' },
              { title: 'Movement Classes', desc: 'Ongoing wellness classes for body and mind', emoji: '💪' },
              { title: 'Wellness Boxes', desc: 'Curated wellness kits for your team', emoji: '📦' },
              { title: 'Custom Programming', desc: 'Tailored solutions for your unique needs', emoji: '✨' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-2xl">{item.emoji}</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}