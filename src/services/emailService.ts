import { send } from "process";
import { resend } from "../common/resend";

interface EmailParams {
    to: string;
    subject: string;
    html: string;
}

const sendEmail = async ({ to, subject, html }: EmailParams) => {
    try {
        const data = await resend.emails.send({
            from: 'Acme <onboarding@resend.dev>',
            to: [to],
            subject: subject,
            html: html,
        });
        console.log(`Email sent successfully: ${to}`);
        return data;
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        throw error;
    }
};

const sendOrderConfirmation = async (toEmail: string, orderId: string, totalAmount: number) => {
    const htmlTemplate = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2 style="color: #333;">Thank you! We've received your order. 🛍️</h2>
      <p>Your order has been successfully created and is currently being prepared.</p>
      <hr />
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Total Amount Paid:</strong> $${totalAmount.toFixed(2)}</p>
      <hr />
      <p>Thank you for choosing us!</p>
    </div>
  `;
   return sendEmail({
        to: toEmail,
        subject: 'Your Order is Confirmed!',
        html: htmlTemplate,
    });
};
 
export default{
    sendEmail,
    sendOrderConfirmation
}