import { useState } from 'react';
import { SiteNav } from '@/components/SiteNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Check, Users, Shield, Headphones, Zap } from 'lucide-react';
import { toast } from 'sonner';

const ENTERPRISE_FEATURES = [
  { icon: Users, text: 'Unlimited team seats' },
  { icon: Zap, text: 'Custom credit allocation' },
  { icon: Shield, text: 'SSO & SAML authentication' },
  { icon: Headphones, text: 'Dedicated account manager' },
  { icon: Building2, text: 'Custom integrations & API' },
];

export default function EnterprisePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('https://submit-form.com/w1HPVYYy4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          company: formData.get('company'),
          message: formData.get('message'),
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        toast.success('Thank you! We\'ll be in touch soon.');
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      toast.error('Failed to submit. Please try again or email us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <SiteNav />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-6">
              <Building2 className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Enterprise Plan</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Custom solutions for larger teams and organizations. 
              Get dedicated support, advanced security, and unlimited scale.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Features */}
            <Card className="border-4 border-black">
              <CardHeader>
                <CardTitle>What's Included</CardTitle>
                <CardDescription>
                  Everything in Business, plus:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {ENTERPRISE_FEATURES.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <feature.icon className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="font-medium">{feature.text}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-8 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-800">
                    <strong>Flexible pricing tailored to your needs</strong><br/>
                    Pricing based on seats, usage, and custom requirements.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Contact Form */}
            <Card className="border-4 border-black">
              <CardHeader>
                <CardTitle>Contact Sales</CardTitle>
                <CardDescription>
                  Tell us about your team and requirements
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isSubmitted ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Thank You!</h3>
                    <p className="text-gray-600">
                      We've received your inquiry and will be in touch within 24 hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input 
                        type="text" 
                        id="name" 
                        name="name" 
                        placeholder="Your name" 
                        required 
                        className="input-brutal"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Work Email *</Label>
                      <Input 
                        type="email" 
                        id="email" 
                        name="email" 
                        placeholder="you@company.com" 
                        required 
                        className="input-brutal"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input 
                        type="text" 
                        id="company" 
                        name="company" 
                        placeholder="Your company name" 
                        className="input-brutal"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="message">Message *</Label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Tell us about your team size, use case, and any specific requirements..."
                        required
                        rows={4}
                        className="input-brutal resize-none"
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Sending...' : 'Get in Touch'}
                    </Button>
                    
                    <p className="text-xs text-gray-500 text-center">
                      We typically respond within 24 hours.
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
