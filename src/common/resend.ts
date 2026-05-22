import { Resend } from "resend";
import './env';

export const resend = new Resend(process.env.RESEND_API_KEY ?? '');