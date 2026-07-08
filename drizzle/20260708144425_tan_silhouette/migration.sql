CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY,
	"organization_id" integer,
	"name" varchar NOT NULL,
	"email" varchar,
	"phone" varchar,
	"address" varchar,
	"city" varchar,
	"country" varchar,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY,
	"invoice_number" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"issue_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" varchar NOT NULL,
	"signature" varchar,
	"tax_rate" numeric DEFAULT '0' NOT NULL,
	"discount" numeric DEFAULT '0' NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"notes" varchar,
	"currency" varchar NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"start_date" timestamp with time zone DEFAULT now(),
	"end_date" timestamp with time zone,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "organizations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL UNIQUE,
	"type" varchar NOT NULL,
	"address" varchar,
	"city" varchar,
	"country" varchar,
	"website" varchar,
	"logo_url" varchar,
	"invoice_number" jsonb DEFAULT '{"currentNumber":0,"year":2000}' NOT NULL,
	"referral_code" varchar UNIQUE,
	"referred_by" integer UNIQUE,
	"referral_enabled" boolean DEFAULT false NOT NULL,
	"total_earnings" numeric DEFAULT '0' NOT NULL,
	"paystack_customer_code" varchar UNIQUE,
	"paystack_customer_id" integer UNIQUE,
	"paystack_plan_code" varchar,
	"paystack_plan_id" integer,
	"paystack_subscription_status" varchar DEFAULT 'none' NOT NULL,
	"payment_provider" varchar DEFAULT 'paystack' NOT NULL,
	"stripe_customer_id" varchar UNIQUE,
	"stripe_subscription_id" varchar,
	"stripe_plan_code" varchar,
	"stripe_plan_id" varchar,
	"stripe_subscription_status" varchar DEFAULT 'none' NOT NULL,
	"currency" varchar DEFAULT 'NGN' NOT NULL,
	"referral_payout_method" varchar,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payouts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" integer NOT NULL,
	"amount" numeric NOT NULL,
	"currency" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"provider" varchar NOT NULL,
	"reference" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL UNIQUE,
	"permissions" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" varchar NOT NULL UNIQUE,
	"currency_organization_id" integer NOT NULL,
	"firstname" varchar,
	"lastname" varchar,
	"username" varchar NOT NULL,
	"avatar_url" varchar,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_referred_by_organizations_id_fkey" FOREIGN KEY ("referred_by") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_currency_organization_id_organizations_id_fkey" FOREIGN KEY ("currency_organization_id") REFERENCES "organizations"("id");