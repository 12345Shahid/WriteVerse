import { Resend } from 'resend';

// Initialize Resend with API key from environment variables
// Note: During development, if no key is provided, it will fail gracefully or log an error
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY) 
  : null;

export const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not found. Email not sent:', { to, subject });
    return { success: false, error: 'Missing API Key' };
  }

  try {
    const data = await resend.emails.send({
      from: 'WriteAI <onboarding@resend.dev>', // Update this with your verified domain later
      to,
      subject,
      html,
    });
    
    console.log('[Email] Sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return { success: false, error };
  }
};

interface InvoiceDetails {
  customerName?: string;
  amount: number;
  currency: string;
  date: string;
  items: Array<{ description: string; amount: number }>;
  invoiceId: string;
  invoicePdfUrl?: string;
}

export const generateInvoiceHtml = (details: InvoiceDetails) => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: details.currency.toUpperCase(),
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: sans-serif; color: #333; line-height: 1.5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
        .invoice-details { margin-bottom: 24px; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .table th { text-align: left; border-bottom: 2px solid #eee; padding: 8px 0; }
        .table td { border-bottom: 1px solid #eee; padding: 8px 0; }
        .total { text-align: right; font-weight: bold; font-size: 1.2em; }
        .footer { margin-top: 40px; font-size: 0.8em; color: #666; text-align: center; }
        .button { display: inline-block; padding: 10px 20px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Purchase Receipt</h1>
          <p>Thank you for your purchase!</p>
        </div>
        
        <div class="invoice-details">
          <p><strong>Invoice ID:</strong> ${details.invoiceId}</p>
          <p><strong>Date:</strong> ${details.date}</p>
          ${details.customerName ? `<p><strong>Billed to:</strong> ${details.customerName}</p>` : ''}
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${details.items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td style="text-align: right;">${formatter.format(item.amount / 100)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total">
          Total: ${formatter.format(details.amount / 100)}
        </div>

        ${details.invoicePdfUrl ? `
          <div style="margin-top: 24px; text-align: center;">
            <a href="${details.invoicePdfUrl}" class="button">Download PDF Invoice</a>
          </div>
        ` : ''}

        <div class="footer">
          <p>If you have any questions, please reply to this email.</p>
          <p>WriteAI Inc.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
