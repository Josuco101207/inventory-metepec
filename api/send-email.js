/* global process */
import nodemailer from 'nodemailer';

// Vercel Serverless Function
export default async function handler(req, res) {
  // Manejar CORS (preflight request)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'to, subject y content (html o text) son requeridos' });
    }

    const gmailEmail = process.env.GMAIL_EMAIL;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailEmail || !gmailPassword) {
      console.warn('Faltan credenciales GMAIL_EMAIL o GMAIL_APP_PASSWORD en Vercel.');
      return res.status(500).json({ error: 'Configuración de correo incompleta' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailEmail,
        pass: gmailPassword,
      },
    });

    const mailOptions = {
      from: `"Sistema Dicrejart" <${gmailEmail}>`,
      to,
      subject,
      html: html || text, // Usamos text como fallback si no hay html
      text: text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email enviado:', info.messageId);

    return res.status(200).json({ 
      success: true, 
      messageId: info.messageId,
      message: 'Email enviado exitosamente' 
    });

  } catch (error) {
    console.error('Error enviando email:', error);
    return res.status(500).json({ error: error.message || 'Error interno' });
  }
}
