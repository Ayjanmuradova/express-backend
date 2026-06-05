import logger from "../common/logger";
import { resend } from "../common/resend";

interface EmailParams {
    to: string;
    subject: string;
    html: string;
}

interface LineItem {
    name: string;
    quantity: number;
    unitPrice: number;
}

const sendEmail = async ({ to, subject, html }: EmailParams) => {
    try {
        const data = await resend.emails.send({
            from: 'Acme <onboarding@resend.dev>',
            to: [to],
            subject: subject,
            html: html,
        });
        logger.info(`Email sent successfully: ${to}`);
        return data;
    } catch (error) {
        logger.error(`Failed to send email to ${to}:`, error);
        throw error;
    }
};

const sendOrderConfirmation = async (toEmail: string, orderId: string, totalAmount: number, items: LineItem[]) => {
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        </tr>
    `).join('');
    
    const htmlTemplate = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2 style="color: #333;">Thank you! We've received your order. 🛍️</h2>
      <p>Your order has been successfully created and is currently being prepared.</p>
      <hr />
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px;">
          <thead>
              <tr>
                  <th style="text-align: left; padding: 8px; border-bottom: 2px solid #333;">Product</th>
                  <th style="text-align: center; padding: 8px; border-bottom: 2px solid #333;">Quantity</th>
                  <th style="text-align: right; padding: 8px; border-bottom: 2px solid #333;">Price</th>
              </tr>
          </thead>
          <tbody>
              ${itemsHtml}
          </tbody>
      </table>
      <p style="text-align: right; font-size: 18px;"><strong>Total Amount Paid:</strong> $${totalAmount.toFixed(2)}</p>
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