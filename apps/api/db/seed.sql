-- Fictional local tenants for development and migration verification.
-- Safe to re-run: fixed IDs are upserted instead of duplicated.

INSERT INTO tenant (id, name)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'Evergreen Advisory Local'),
    ('22222222-2222-4222-8222-222222222222', 'Harbor Point Wealth Local')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name;
