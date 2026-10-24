


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."php_counter_distinct_pets_vaccinated"() RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(distinct pet_id)::integer from vaccinations;
$$;


ALTER FUNCTION "public"."php_counter_distinct_pets_vaccinated"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text",
    "checked_in_at" timestamp with time zone,
    "seen_at" timestamp with time zone,
    "archived" boolean DEFAULT false,
    "event_date" "date",
    "street" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "waiver_signature" "text",
    "waiver_signed_at" timestamp with time zone,
    "notes" "text",
    "snip_interest" boolean DEFAULT false NOT NULL,
    "preferred_language" "text",
    CONSTRAINT "clients_preferred_language_check" CHECK (("preferred_language" = ANY (ARRAY['en'::"text", 'es'::"text"]))),
    CONSTRAINT "clients_status_check" CHECK (("status" = ANY (ARRAY['registered'::"text", 'checked_in'::"text", 'seen'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_clients_unaccent"("search_term" "text") RETURNS SETOF "public"."clients"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT * FROM clients
  WHERE
    archived = false
    AND (
      unaccent(lower(name))  ILIKE unaccent(lower('%' || search_term || '%'))
      OR lower(email) ILIKE lower('%' || search_term || '%')
      OR lower(phone) ILIKE lower('%' || search_term || '%')
    )
  ORDER BY name ASC
  LIMIT 50;
$$;


ALTER FUNCTION "public"."search_clients_unaccent"("search_term" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_vaccination_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_vaccination_created_by"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "pet_id" "uuid",
    "storage_path" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resend_email_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "client_id" "uuid",
    "email" "text",
    "raw_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email_type" "text"
);


ALTER TABLE "public"."email_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_send_failures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "email" "text" NOT NULL,
    "context" "text" NOT NULL,
    "event_date" "date",
    "clinic_type" "text",
    "error" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_send_failures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "location" "text" NOT NULL,
    "clinic_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "name" "text" NOT NULL,
    "species" "text",
    "breed" "text",
    "weight" numeric,
    "age" numeric,
    "sex" "text",
    "altered" "text",
    "microchip_number" "text",
    "archived" boolean DEFAULT false,
    "microchipped" "text" DEFAULT 'unknown'::"text",
    "colors_markings" "text",
    "age_unit" "text" DEFAULT 'years'::"text",
    "archive_reason" "text",
    "archive_note" "text",
    "photo_updated_at" timestamp with time zone,
    CONSTRAINT "pets_altered_check" CHECK (("altered" = ANY (ARRAY['yes'::"text", 'no'::"text", 'unknown'::"text"]))),
    CONSTRAINT "pets_sex_check" CHECK (("sex" = ANY (ARRAY['male'::"text", 'female'::"text", 'unknown'::"text"]))),
    CONSTRAINT "pets_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text"])))
);


ALTER TABLE "public"."pets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vaccinations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid",
    "vaccine_name" "text" NOT NULL,
    "date_given" "date" NOT NULL,
    "next_due" "date",
    "administered_by" "text",
    "lot_number" "text",
    "serial_number" "text",
    "rabies_tag_number" "text",
    "colors_markings" "text",
    "product_name" "text",
    "manufacturer" "text",
    "usda_duration" "text",
    "dose_type" "text",
    "ac_license_number" "text",
    "ac_license_type" "text",
    "reminder_2w_sent" boolean DEFAULT false,
    "reminder_1w_sent" boolean DEFAULT false,
    "exp_date" "date",
    "created_by" "uuid"
);


ALTER TABLE "public"."vaccinations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."pet_next_due" AS
 SELECT "p"."id" AS "pet_id",
    "p"."name" AS "pet_name",
    "p"."species",
    "p"."breed",
    "p"."client_id",
    "c"."name" AS "owner_name",
    "c"."phone" AS "owner_phone",
    "c"."email" AS "owner_email",
    "jsonb_agg"("jsonb_build_object"('vaccine_name', "v"."vaccine_name", 'next_due', "v"."next_due") ORDER BY "v"."next_due") FILTER (WHERE ("v"."next_due" IS NOT NULL)) AS "due_dates",
    "min"("v"."next_due") AS "soonest_due"
   FROM (("public"."pets" "p"
     JOIN "public"."clients" "c" ON (("c"."id" = "p"."client_id")))
     LEFT JOIN "public"."vaccinations" "v" ON (("v"."pet_id" = "p"."id")))
  WHERE (("p"."archived" IS NOT TRUE) AND ("c"."archived" IS NOT TRUE))
  GROUP BY "p"."id", "p"."name", "p"."species", "p"."breed", "p"."client_id", "c"."name", "c"."phone", "c"."email";


ALTER VIEW "public"."pet_next_due" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."postclinic_email_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "event_date" "date" NOT NULL,
    "clinic_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resend_email_id" "text"
);


ALTER TABLE "public"."postclinic_email_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."queue_state" (
    "id" integer DEFAULT 1 NOT NULL,
    "now_serving" integer DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "single_row" CHECK (("id" = 1))
);


ALTER TABLE "public"."queue_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reminder_email_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vaccination_id" "uuid",
    "reminder_type" "text" NOT NULL,
    "resend_email_id" "text",
    "sent_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reminder_email_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."triggers" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "event" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "template_en" "text" NOT NULL,
    "template_es" "text" NOT NULL,
    "send_delay_days" integer DEFAULT 0 NOT NULL,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "triggers_event_check" CHECK (("event" = ANY (ARRAY['post_clinic'::"text", 'post_booster'::"text", 'reminder_2w'::"text", 'reminder_1w'::"text"])))
);


ALTER TABLE "public"."triggers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vaccine_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vaccine_type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "lot_number" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deactivated_at" timestamp with time zone,
    "archived" boolean DEFAULT false NOT NULL,
    "manufacturer" "text",
    "exp_date" "date"
);


ALTER TABLE "public"."vaccine_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vaccine_waste" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "vaccine_name" "text" NOT NULL,
    "doses_wasted" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "vaccine_waste_doses_wasted_check" CHECK (("doses_wasted" > 0))
);


ALTER TABLE "public"."vaccine_waste" OWNER TO "postgres";


ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_events"
    ADD CONSTRAINT "email_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_send_failures"
    ADD CONSTRAINT "email_send_failures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."postclinic_email_log"
    ADD CONSTRAINT "postclinic_email_log_client_id_event_date_clinic_type_key" UNIQUE ("client_id", "event_date", "clinic_type");



ALTER TABLE ONLY "public"."postclinic_email_log"
    ADD CONSTRAINT "postclinic_email_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."queue_state"
    ADD CONSTRAINT "queue_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminder_email_log"
    ADD CONSTRAINT "reminder_email_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminder_email_log"
    ADD CONSTRAINT "reminder_email_log_vaccination_id_reminder_type_key" UNIQUE ("vaccination_id", "reminder_type");



ALTER TABLE ONLY "public"."triggers"
    ADD CONSTRAINT "triggers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vaccinations"
    ADD CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vaccine_inventory"
    ADD CONSTRAINT "vaccine_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vaccine_waste"
    ADD CONSTRAINT "vaccine_waste_pkey" PRIMARY KEY ("id");



CREATE INDEX "email_events_client_id_idx" ON "public"."email_events" USING "btree" ("client_id");



CREATE INDEX "email_events_resend_email_id_idx" ON "public"."email_events" USING "btree" ("resend_email_id");



CREATE INDEX "pets_client_id_idx" ON "public"."pets" USING "btree" ("client_id");



CREATE INDEX "vaccinations_pet_id_idx" ON "public"."vaccinations" USING "btree" ("pet_id");



CREATE OR REPLACE TRIGGER "vaccination_set_created_by" BEFORE INSERT ON "public"."vaccinations" FOR EACH ROW EXECUTE FUNCTION "public"."set_vaccination_created_by"();



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_events"
    ADD CONSTRAINT "email_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."email_send_failures"
    ADD CONSTRAINT "email_send_failures_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."postclinic_email_log"
    ADD CONSTRAINT "postclinic_email_log_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminder_email_log"
    ADD CONSTRAINT "reminder_email_log_vaccination_id_fkey" FOREIGN KEY ("vaccination_id") REFERENCES "public"."vaccinations"("id");



ALTER TABLE ONLY "public"."vaccinations"
    ADD CONSTRAINT "vaccinations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vaccinations"
    ADD CONSTRAINT "vaccinations_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vaccine_waste"
    ADD CONSTRAINT "vaccine_waste_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vaccine_waste"
    ADD CONSTRAINT "vaccine_waste_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



CREATE POLICY "Anon can read clients for queue display" ON "public"."clients" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anon can read queue state" ON "public"."queue_state" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Authenticated can read queue state" ON "public"."queue_state" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can update queue state" ON "public"."queue_state" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert waste" ON "public"."vaccine_waste" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read waste" ON "public"."vaccine_waste" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public can read events" ON "public"."events" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Staff can manage events" ON "public"."events" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "anon can delete vaccinations" ON "public"."vaccinations" FOR DELETE TO "anon" USING (true);



CREATE POLICY "anon can select clients" ON "public"."clients" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon can select pets" ON "public"."pets" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon can select vaccinations" ON "public"."vaccinations" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon can update clients" ON "public"."clients" FOR UPDATE TO "anon" USING (true);



CREATE POLICY "anon can update pets" ON "public"."pets" FOR UPDATE TO "anon" USING (true);



ALTER TABLE "public"."attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated can delete" ON "public"."clients" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated can delete" ON "public"."pets" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated can delete attachments" ON "public"."attachments" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated can delete events" ON "public"."events" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated can delete vaccinations" ON "public"."vaccinations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated can insert attachments" ON "public"."attachments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated can insert clients" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated can insert events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated can insert vaccine_inventory" ON "public"."vaccine_inventory" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated can read vaccine_inventory" ON "public"."vaccine_inventory" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated can select attachments" ON "public"."attachments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated can select events" ON "public"."events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated can update clients" ON "public"."clients" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated can update events" ON "public"."events" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated can update pets" ON "public"."pets" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated can update vaccinations" ON "public"."vaccinations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated can update vaccine_inventory" ON "public"."vaccine_inventory" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_events_select" ON "public"."email_events" FOR SELECT USING (true);



ALTER TABLE "public"."email_send_failures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_send_failures_select" ON "public"."email_send_failures" FOR SELECT USING (true);



ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."postclinic_email_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "postclinic_log_insert" ON "public"."postclinic_email_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "postclinic_log_select" ON "public"."postclinic_email_log" FOR SELECT USING (true);



CREATE POLICY "public can insert clients" ON "public"."clients" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "public can insert pets" ON "public"."pets" FOR INSERT TO "anon" WITH CHECK (true);



ALTER TABLE "public"."queue_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminder_email_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reminder_email_log_select" ON "public"."reminder_email_log" FOR SELECT USING (true);



CREATE POLICY "staff can insert pets" ON "public"."pets" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "staff can insert vaccinations" ON "public"."vaccinations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "staff can read clients" ON "public"."clients" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "staff can read pets" ON "public"."pets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "staff can read templates" ON "public"."email_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "staff can read vaccinations" ON "public"."vaccinations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "staff can update templates" ON "public"."email_templates" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."triggers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "triggers_delete" ON "public"."triggers" FOR DELETE USING (true);



CREATE POLICY "triggers_insert" ON "public"."triggers" FOR INSERT WITH CHECK (true);



CREATE POLICY "triggers_select" ON "public"."triggers" FOR SELECT USING (true);



CREATE POLICY "triggers_update" ON "public"."triggers" FOR UPDATE USING (true);



ALTER TABLE "public"."vaccinations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vaccine_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vaccine_waste" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."php_counter_distinct_pets_vaccinated"() TO "anon";
GRANT ALL ON FUNCTION "public"."php_counter_distinct_pets_vaccinated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."php_counter_distinct_pets_vaccinated"() TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON FUNCTION "public"."search_clients_unaccent"("search_term" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_clients_unaccent"("search_term" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_clients_unaccent"("search_term" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_vaccination_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_vaccination_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_vaccination_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";


















GRANT ALL ON TABLE "public"."attachments" TO "anon";
GRANT ALL ON TABLE "public"."attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."attachments" TO "service_role";



GRANT ALL ON TABLE "public"."email_events" TO "anon";
GRANT ALL ON TABLE "public"."email_events" TO "authenticated";
GRANT ALL ON TABLE "public"."email_events" TO "service_role";



GRANT ALL ON TABLE "public"."email_send_failures" TO "anon";
GRANT ALL ON TABLE "public"."email_send_failures" TO "authenticated";
GRANT ALL ON TABLE "public"."email_send_failures" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."pets" TO "anon";
GRANT ALL ON TABLE "public"."pets" TO "authenticated";
GRANT ALL ON TABLE "public"."pets" TO "service_role";



GRANT ALL ON TABLE "public"."vaccinations" TO "anon";
GRANT ALL ON TABLE "public"."vaccinations" TO "authenticated";
GRANT ALL ON TABLE "public"."vaccinations" TO "service_role";



GRANT ALL ON TABLE "public"."pet_next_due" TO "anon";
GRANT ALL ON TABLE "public"."pet_next_due" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_next_due" TO "service_role";



GRANT ALL ON TABLE "public"."postclinic_email_log" TO "anon";
GRANT ALL ON TABLE "public"."postclinic_email_log" TO "authenticated";
GRANT ALL ON TABLE "public"."postclinic_email_log" TO "service_role";



GRANT ALL ON TABLE "public"."queue_state" TO "anon";
GRANT ALL ON TABLE "public"."queue_state" TO "authenticated";
GRANT ALL ON TABLE "public"."queue_state" TO "service_role";



GRANT ALL ON TABLE "public"."reminder_email_log" TO "anon";
GRANT ALL ON TABLE "public"."reminder_email_log" TO "authenticated";
GRANT ALL ON TABLE "public"."reminder_email_log" TO "service_role";



GRANT ALL ON TABLE "public"."triggers" TO "anon";
GRANT ALL ON TABLE "public"."triggers" TO "authenticated";
GRANT ALL ON TABLE "public"."triggers" TO "service_role";



GRANT ALL ON TABLE "public"."vaccine_inventory" TO "anon";
GRANT ALL ON TABLE "public"."vaccine_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."vaccine_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."vaccine_waste" TO "anon";
GRANT ALL ON TABLE "public"."vaccine_waste" TO "authenticated";
GRANT ALL ON TABLE "public"."vaccine_waste" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































