import React from 'react';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link as LinkIcon, Clock, Sparkles } from 'lucide-react';

// Popular integrations to show as "coming soon"
const COMING_SOON_INTEGRATIONS = [
  { name: 'Notion', icon: '📝', category: 'Productivity' },
  { name: 'Slack', icon: '💬', category: 'Communication' },
  { name: 'HubSpot', icon: '📊', category: 'CRM' },
  { name: 'Salesforce', icon: '☁️', category: 'CRM' },
  { name: 'Google Sheets', icon: '📈', category: 'Productivity' },
  { name: 'Airtable', icon: '📋', category: 'Database' },
  { name: 'WordPress', icon: '🌐', category: 'Publishing' },
  { name: 'Mailchimp', icon: '📧', category: 'Email' },
  { name: 'Buffer', icon: '📱', category: 'Social' },
  { name: 'Zapier', icon: '⚡', category: 'Automation' },
  { name: 'Google Docs', icon: '📄', category: 'Productivity' },
  { name: 'Trello', icon: '📌', category: 'Project Management' },
];

export default function IntegrationsTab() {
  return (
    <ToolLayout title="Integrations" description="Connect your favorite tools to sync content automatically">
      <div className="max-w-6xl mx-auto space-y-8 mt-6">
        
        {/* Coming Soon Banner */}
        <Card className="border-2 border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 shadow-brutal">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="relative mb-4">
              <LinkIcon className="h-12 w-12 text-purple-600" />
              <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black uppercase mb-2">130+ Integrations Coming Soon!</h2>
            <p className="text-muted-foreground max-w-lg">
              We're working on connecting WriterAI to your favorite tools. 
              Soon you'll be able to automatically sync your generated content to Notion, Slack, HubSpot, and more!
            </p>
            <div className="flex items-center gap-2 mt-4 text-purple-600">
              <Clock className="h-4 w-4" />
              <span className="font-semibold">Expected: Q1 2025</span>
            </div>
          </CardContent>
        </Card>

        {/* How It Will Work */}
        <Card className="border-2 border-black shadow-brutal">
          <CardHeader>
            <CardTitle>How It Will Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>One-click connect</strong> to your favorite apps</p>
            <p>• <strong>Generate content</strong> using any tool or workflow</p>
            <p>• <strong>Automatic sync</strong> to Notion, Slack, HubSpot, and 130+ apps</p>
            <p>• <strong>No manual export</strong> - content flows where you need it</p>
          </CardContent>
        </Card>

        {/* Coming Soon Grid */}
        <Card className="border-2 border-black shadow-brutal">
          <CardHeader>
            <CardTitle>Integrations Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {COMING_SOON_INTEGRATIONS.map(integration => (
                <div
                  key={integration.name}
                  className="relative p-4 border-2 border-gray-200 rounded-lg text-center bg-gray-50 opacity-75"
                >
                  {/* Coming Soon Badge */}
                  <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    SOON
                  </div>
                  
                  <div className="text-3xl mb-2 grayscale">{integration.icon}</div>
                  <p className="font-bold text-sm">{integration.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{integration.category}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Get Notified */}
        <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-2">
              Want to be notified when integrations launch?
            </p>
            <p className="text-sm text-muted-foreground">
              We'll announce it in-app and via email when it's ready!
            </p>
          </CardContent>
        </Card>
      </div>
    </ToolLayout>
  );
}
