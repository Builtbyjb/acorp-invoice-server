-- Custom SQL migration file, put your code below! --
INSERT INTO "roles" ("name", "permissions") VALUES
  ('SuperAdmin', 'read:write:delete'),
  ('Admin', 'read:write'),
  ('Member', 'read')
ON CONFLICT ("name") DO NOTHING;
