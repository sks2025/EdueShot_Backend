import nodemailer from 'nodemailer';
import dotenv from 'dotenv';


dotenv.config();

export const transporter = nodemailer.createTransport({
     host: "smtp-relay.brevo.com",
     port: 587,
     secure: false, // true for 465, false for other ports
     auth: {
       user: process.env.SMTP_USER,
       pass: process.env.SMTP_PASS,
     }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP Configuration Error:', error);
  } else {
    console.log('SMTP Server is ready to send emails');
  }
});

