import { Request, Response, NextFunction } from 'express';
import { STRIPE_ENDPOINT_SECRET, stripe } from '../../common/stripe';
import { prisma } from '../../common/prisma';
import emailService from '../../services/emailService';

const receiveUpdates = async (request: Request, response: Response, next: NextFunction) => {
  let event = request.body;

  if (STRIPE_ENDPOINT_SECRET) {
    const signature = request.headers['stripe-signature'];

    if (!signature) {
      console.error('Stripe signature is missing from the request');
      return response.sendStatus(400);
    }

    try {
      event = stripe.webhooks.constructEvent(request.body, signature, STRIPE_ENDPOINT_SECRET);
    } catch (err) {
      return response.sendStatus(400);
    }
  }

  // Handle the event
  switch (event.type) {
    // charge.succeeded, payment_intent.succeeded, payment_intent.created, checkout.session.completed
    case 'checkout.session.completed': {
      const eventData = event.data.object;
      console.log(`Event data`);
      console.log(eventData);

      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(eventData.id);

        for (const item of lineItems.data) {
          const stripeProductId = item.price?.product as string;
          const quantitySold = item.quantity || 1;
          try {
            await prisma.product.update({
              where: {
                stripeProductId: stripeProductId,
              },
              data: {
                stock: {
                  decrement: quantitySold,
                },
              },
            });
          } catch (error: any) {
            if (error.code === 'P2025') {
              console.error(`Product with stripeProductId ${error.meta.stripeProductId} not found in the database.`);
            } else {
              console.error(`An error occurred while updating stock for session ${eventData.id}:`, error);
            }
          }
        }
        console.log(`Stock updated successfully for session ${eventData.id}`);

        const totalAmount = eventData.amount_total ? eventData.amount_total / 100 : 0; // Convert from cents to dollars

        const userId = eventData.metadata?.userId || null;
        await prisma.order.create({
          data: {
            userId: userId,
            totalAmount: totalAmount,
            stripeSessionId: eventData.id,
          },
        });
        console.log(`Order created successfully for session ${eventData.id}`);

        const customerEmail = eventData.customer_details?.email; // Get customer email from the event data
        if (customerEmail) {
          await emailService.sendOrderConfirmation(customerEmail, eventData.id, totalAmount);
        }
      } catch (error) {
        console.error(`An error occurred while processing the checkout session ${eventData.id}:`, error);
      }
      break;
    }

    case 'checkout.session.expired': {
      const paymentMethod = event.data.object;
      console.log(`Checkout session expired for session ${event.data.object.id}`);
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}.`);
  }

  response.send();
};

export default {
  receiveUpdates,
};
