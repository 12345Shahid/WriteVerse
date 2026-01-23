import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { getUserIdFromHeader } from '../_lib/supabase.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS params
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await resend.emails.send({
      from: 'WriterAI Agent <agent@yourdomain.com>', // User needs to configure this in env
      to: [to],
      subject: subject,
      html: html,
      text: text,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: err.message });
  }
}
