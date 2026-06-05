import { Request, Response, NextFunction } from 'express';
import { STRIPE_ENDPOINT_SECRET, stripe } from '../../common/stripe';
import { prisma } from '../../common/prisma';
import emailService from '../../services/emailService';
import logger from '../../common/logger';

const receiveUpdates = async (request: Request, response: Response, next: NextFunction) => {
  let event = request.body;

  if (STRIPE_ENDPOINT_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is required');
  }
    const signature = request.headers['stripe-signature'];

    if (!signature) {
      logger.error('Stripe signature is missing from the request');
      return response.sendStatus(400).send('Stripe signature is missing');
    }

    try {
      event = stripe.webhooks.constructEvent(request.body, signature, STRIPE_ENDPOINT_SECRET as string);
    } catch (err) {
      logger.error('Webhook signature verification failed.', err);
      return response.sendStatus(400).send('Webhook error');
    }
  
  // Handle the event
  switch (event.type) {
    // charge.succeeded, payment_intent.succeeded, payment_intent.created, checkout.session.completed
    case 'checkout.session.completed': {
      const eventData = event.data.object;
      logger.info(`Event data received for session ${eventData.id}`);

    const existingOrder = await prisma.order.findUnique({
        where: { stripeSessionId: eventData.id },
    });
    if (existingOrder) {
        logger.info(`Order for session ${eventData.id} already processed, skipping.`);
        return response.status(200).send(); 
      }

      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(eventData.id);
        const orderItemsData = [];
        const emailItems = [];

        for (const item of lineItems.data) {
          const stripeProductId = item.price?.product as string;
          const quantitySold = item.quantity || 1;
          const unitPrice = item.price?.unit_amount ? item.price.unit_amount / 100 : 0;

          try {
            const dbProduct = await prisma.product.update({
              where: {
                stripeProductId: stripeProductId,
              },
              data: {
                stock: {
                  decrement: quantitySold,
                },
              },
            });
            orderItemsData.push({
              productId: dbProduct.id,
              name: dbProduct.name,
              unitPrice: unitPrice,
              quantity: quantitySold,
            });

            emailItems.push({
              name: dbProduct.name,
              quantity: quantitySold,
              unitPrice: unitPrice,
            });

          } catch (error: any) {
            if (error.code === 'P2025') {
              logger.error(`Product with stripeProductId ${stripeProductId} not found in the database.`);
            } else {
              logger.error(`Error updating stock for session ${eventData.id}:`, error);
            }
          }
        }
        logger.info(`Stock updated successfully for session ${eventData.id}`);

        const totalAmount = eventData.amount_total ? eventData.amount_total / 100 : 0; // Convert from cents to dollars
        const userId = eventData.metadata?.userId || null;
        await prisma.order.create({
          data: {
            userId: userId,
            totalAmount: totalAmount,
            stripeSessionId: eventData.id,
            items:{
              create: orderItemsData
            }
          },
        });
        logger.info(`Order created successfully for session ${eventData.id}`);

        const customerEmail = eventData.customer_details?.email; // Get customer email from the event data
        if (customerEmail) {
          await emailService.sendOrderConfirmation(customerEmail, eventData.id, totalAmount, emailItems);
        }
      } catch (error) {
        logger.error(`Critical error processing session ${eventData.id}:`, error);
        return response.status(500).send('Internal Server Error');
      }
      break;
    }

    case 'checkout.session.expired': {
      logger.info(`Checkout session expired for session ${event.data.object.id}`);
      break;
    }
    default:
      logger.info(`Unhandled event type ${event.type}.`);
  }

  response.status(200).send();
};

export default {
  receiveUpdates,
};
