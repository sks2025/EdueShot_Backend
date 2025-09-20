import nodemailer from 'nodemailer';

// ✅ Direct use (for quick testing ONLY – not for production)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    secure: true,   // use SSL
    port: 465,
    auth: {
        user: 'aman367787@gmail.com',       // Gmail address
        pass: 'zhtm lmla tiep jgnc',        // 16-character Gmail App Password
    },
});

// ✅ Function to send email
const sendEmail = async (to, subject, text, html = null) => {
    try {
        const mailOptions = {
            from: 'aman367787@gmail.com',   // sender address
            to,                             // recipient(s)
            subject,
            text,
            html: html || text
        };

        const info = await transporter.sendMail(mailOptions);
       
        return info;
    } catch (error) {
      
        throw error;
    }
};

export default sendEmail;
