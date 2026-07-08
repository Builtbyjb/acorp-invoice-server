ALTER TABLE "organizations" DROP CONSTRAINT "organizations_paystack_customer_code_key";--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_paystack_customer_id_key";--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_stripe_customer_id_key";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "client_name" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "paystack_customer_code";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "paystack_customer_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "paystack_plan_code";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "paystack_plan_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "paystack_subscription_status";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "payment_provider";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "stripe_plan_code";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "stripe_plan_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "stripe_subscription_status";