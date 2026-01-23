import 'dotenv/config';
import { sendEmail, generateInvoiceHtml } from './server/resend.ts';

async function testEmail() {
  console.log('Testing Resend Email Integration...');
  
  if (!process.env.RESEND_API_KEY) {
    console.error('Error: RESEND_API_KEY is missing in .env');
    return;
  }

  const invoiceDetails = {
    customerName: 'Test User',
    amount: 1000, // $10.00
    currency: 'usd',
    date: new Date().toLocaleDateString(),
    items: [
      { description: 'Test Credits Purchase', amount: 1000 }
    ],
    invoiceId: 'inv_test_123456',
    invoicePdfUrl: 'https://example.com/invoice.pdf'
  };

  const html = generateInvoiceHtml(invoiceDetails);
  
  // Send to a safe test address or the developer's email if possible.
  // Since we don't know the developer's email, we'll log what we would do.
  // But to actually test it, we need a real "to" address. 
  // I will use 'onboarding@resend.dev' which is the default restricted "from" address,
  // but for "to", I'll ask the user to run this script with their email.
  
  // For this automated step, I will just call it with a placeholder to verify the function runs without syntax errors.
  // The actual sending might fail if the API key is invalid or "delivered@resend.dev" is not allowed.
  
  console.log('Sending test email...');
  const result = await sendEmail({
    to: 'delivered@resend.dev', // Resend's test address that always succeeds (simulated)
    subject: 'Test Invoice from WriteAI',
    html,
  });

  if (result.success) {
    console.log('✅ Email sent successfully!');
    console.log('Details:', result.data);
  } else {
    console.error('❌ Failed to send email:', result.error);
  }
}

testEmail();
