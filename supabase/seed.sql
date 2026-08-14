-- Seed-Daten fuer `supabase db reset` (lokal). Laeuft NICHT gegen das
-- verlinkte Projekt — Bucket-Anlage auf Remote ist ein einmaliger manueller
-- Schritt (siehe Kommentar in supabase/schemas/12_recipe_storage.sql).
--
-- `insert into storage.buckets` ist DML, kein DDL, und wird deshalb hier
-- statt in einer Schemadatei gepflegt.

insert into storage.buckets (id, name, public, file_size_limit)
values ('recipe-covers', 'recipe-covers', false, 5242880)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('recipe-step-images', 'recipe-step-images', false, 5242880)
on conflict (id) do nothing;

-- ============================================================
-- Basis-Produkte fuer Rezeptvorlagen (#Recipe-Templates).
--
-- Ueberwiegend echte REWE/EDEKA/Ja!/Gut&Guenstig-Produkte, recherchiert
-- ueber die Open-Food-Facts-Live-API (world.openfoodfacts.org/cgi/search.pl),
-- Nutriments pro 100g/100ml uebernommen. Ein paar unverpackte Grundzutaten
-- (Zwiebeln, Karotten, Knoblauch, Kartoffeln, Bananen, Aepfel, Haehnchenbrust,
-- Zitrone, Honig, Thunfisch, Linsen) haben bei den vier Ketten keine Markenware
-- mit vollstaendigen Naehrwerten in OFF -- dort stehen Standard-Naehrwerte
-- (source = 'manual', kein barcode).
insert into public.products
  (id, barcode, name, brand, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, sugar_g_per_100, salt_g_per_100, source, created_by)
values
  ('7b419bb0-be87-5005-b0c6-4225c701d31d', '4337256552554', 'Weizenmehl 405', 'REWE', 341, 10, 71, 1, 0.9, 0.01, 'off', null),
  ('d6a5a3dd-7f38-5627-8b30-e270a5a5fb96', '4388840217595', 'Zucker', 'ja!', 400, 0, 100, 0, 100, 0, 'off', null),
  ('2a1683a5-a292-5e88-b373-cf8d39b846be', '4337256064880', 'Jod Salz', 'Rewe, Rewe Beste Wahl', 0, 0, 0, 0, 0, 97, 'off', null),
  ('822dcf16-0c0a-5e06-b473-e15521ae62ad', '4337256279086', 'frische Vollmilch 3,5%', 'Rewe, ja!', 65, 3.4, 4.8, 3.6, 4.8, 0.13, 'off', null),
  ('3581cf9f-a44e-5ded-8d50-3b185deda15a', '4337256755429', 'Eier', 'REWE, ja!', 153, 13, 0.6, 11, 0.6, 0.32, 'off', null),
  ('869764ff-4322-5315-b401-d69d0da91252', '4337256537933', 'Spaghetti', 'Ja!, Rewe', 351, 13, 70, 1.4, 3, 0.02, 'off', null),
  ('e06b83d6-c3a4-583b-a36a-57c2fc699eba', '4337256810067', 'Basmatireis', 'Ja!', 352, 8.6, 77, 0.2, 0, 0.01, 'off', null),
  ('9c1838fa-5ef3-58a4-a683-306cdcacc40e', '4337256539975', 'Butter', 'Rewe', 743, 0.7, 0.6, 82, 0.6, 0.03, 'off', null),
  ('ba00e36d-2a23-5607-b809-9b6f72d14e9d', '4388860176179', 'Natives Olivenöl Extra', 'ja!', 822, 0, 0, 91.3, 0, 0, 'off', null),
  ('1435bd1e-16b7-5b61-af7b-ba896491d677', '4021782371665', 'Hackfleisch gemischt', 'Rewe', 235, 18, 0.5, 18, 0.5, 0.2, 'off', null),
  ('9769015e-92ed-54c9-bc23-f6a5677e8338', '4388844170100', 'Fein gehackte Tomaten', 'ja!', 23, 1.2, 3, 0.3, 2.6, 0.5, 'off', null),
  ('7bd2cd4c-5c95-55d4-b6f6-6fdc15bacd04', '4337256911313', 'Tomatenmark', 'REWE', 93, 4, 16, 0.5, 12, 0.1, 'off', null),
  ('495964f4-f59c-54d5-a6a7-96f3108e0763', '4337256596961', 'Gouda', 'Ja!, Rewe', 362, 24, 0.1, 29, 0.1, 1.8, 'off', null),
  ('813d808a-ab08-590f-98d6-cfe4e2eef826', '4337256070539', 'Joghurt mild 3,8% Fett', 'REWE Bio, Rewe', 65, 4.1, 3.7, 3.8, 3.7, 0.1, 'off', null),
  ('3552bd53-8e7d-59a2-9f35-97600b9e858d', '4388844221321', 'Zarte Haferflocken', 'REWE, ja!', 372, 13.5, 58.7, 7, 1, 0.01, 'off', null),
  ('d1d42080-0a0d-5388-90cf-49d775108306', '4337256236942', 'Bio Paprika Rot', 'Rewe', 43, 1.3, 6.4, 0.5, 4.7, 0, 'off', null),
  ('e442767c-f4f1-52c8-bab4-ce00d2ad0565', '4311501675977', 'Backpulver', 'Edeka, Gut & Günstig', 86, 0.1, 21.4, 0, 0, 0.02, 'off', null),
  ('6b9ef4d8-5da8-51fa-85b7-209e7521f6c3', '4337256562355', 'Bio Kakao', 'Rewe', 370, 19.4, 8.9, 21, 0.5, 0.02, 'off', null),
  ('bda3df30-7a7c-5909-a517-191a4a757d93', '4337256811552', 'Kidney-Bohnen', 'REWE, REWE Bio', 95, 6.9, 12, 0.7, 1, 0.5, 'off', null),
  ('8c8b2a6e-1cc8-56fa-bc80-3022ed2a4807', '4337256554466', 'Kichererbsen', 'REWE, ja!', 106, 7.5, 14.2, 0.3, 2, 0.5, 'off', null),
  ('252abf91-4135-5164-98f7-0342d7097fd0', '4337256182584', 'Couscous', 'Rewe', 344, 12.6, 64, 2.2, 1, 0.01, 'off', null),
  ('986090c4-abd3-51ab-83cf-485d6d30374b', '4388840102525', 'Paniermehl', 'Rewe, ja!', 357, 13, 70, 1.6, 4, 1, 'off', null),
  ('fde39f28-ffd1-57d2-a2dc-7f6fb42bfb92', '4388844204096', 'Sojasauce', 'REWE, Rewe Beste Wahl', 21, 2.4, 2.3, 0.2, 1, 14, 'off', null),
  ('f71ec39a-f5b9-5b49-98d5-f337cd6ace83', '4337256011402', 'Frischkäse Natur', 'Rewe', 270, 6, 3, 26, 3, 0.7, 'off', null),
  ('669fa5f9-cfe3-5c78-af75-964c9326efd8', null, 'Zwiebeln', null, 40, 1.1, 9.3, 0.1, 4.2, 0, 'manual', null),
  ('297f392c-c806-5f90-b2b2-b2b54d055ca7', null, 'Karotten', null, 35, 0.9, 7.6, 0.2, 4.7, 0.1, 'manual', null),
  ('2d5e8b74-f732-5ebb-bb29-87ad85bae5ea', null, 'Knoblauch', null, 143, 6.4, 28, 0.5, 1, 0.02, 'manual', null),
  ('061b09fe-9c2a-5a23-94c8-1c610861159f', null, 'Kartoffeln', null, 77, 2, 17, 0.1, 0.8, 0.01, 'manual', null),
  ('5403b232-3d62-53ce-9515-d13982e70155', null, 'Bananen', null, 95, 1.1, 21, 0.3, 12, 0, 'manual', null),
  ('d8fa049a-69b6-5519-bad9-5df38dbb11f0', null, 'Äpfel', null, 52, 0.3, 14, 0.2, 10, 0, 'manual', null),
  ('617e05e0-ad69-5a19-8fd3-225a56b33fd3', null, 'Hähnchenbrustfilet', null, 110, 23, 0, 2, 0, 0.1, 'manual', null),
  ('84197347-44c0-5620-90f8-f6b2a27054f7', null, 'Zitrone', null, 29, 1.1, 9.3, 0.3, 2.5, 0, 'manual', null),
  ('9fe8439d-9aec-5180-9370-c96a7fb8be23', null, 'Honig', null, 304, 0.3, 76, 0, 76, 0, 'manual', null),
  ('3404fb06-6463-5457-98bf-11129c261d6d', null, 'Thunfisch in Wasser, abgetropft', null, 116, 26, 0, 1, 0, 0.9, 'manual', null),
  ('b1210958-463a-585d-9c5d-373cc45981dc', null, 'Linsen rot, getrocknet', null, 325, 24, 52, 1.4, 2, 0.03, 'manual', null)
on conflict (id) do nothing;

-- ============================================================
-- Rezeptvorlagen (#Recipe-Templates): admin-kuratierte Bibliothek,
-- global lesbar (siehe supabase/schemas/15_recipe_templates.sql).
-- Jede Vorlage hat genau eine Komponente (kein Baukasten-Nesting in v1)
-- mit 3-8 Positionen, die auf die oben angelegten Basis-Produkte zeigen.

-- Rührei mit Gouda
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('70121328-f669-5fab-91b5-f5cec9fde031', 'Rührei mit Gouda', 10, 'easy', array['breakfast'], array['vegetarian'], 2, 10)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('9c116245-3a0f-51ee-9f8c-61aec3388e31', '70121328-f669-5fab-91b5-f5cec9fde031', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('eca97417-3c93-5fef-af95-89a13102ba6f', '9c116245-3a0f-51ee-9f8c-61aec3388e31', '70121328-f669-5fab-91b5-f5cec9fde031', '3581cf9f-a44e-5ded-8d50-3b185deda15a', 120, 2, 'piece'),
  ('e127ae1f-6b76-5460-bb28-66d6cc74ee3c', '9c116245-3a0f-51ee-9f8c-61aec3388e31', '70121328-f669-5fab-91b5-f5cec9fde031', '9c1838fa-5ef3-58a4-a683-306cdcacc40e', 15, 15, 'g'),
  ('afafe81d-ad9e-5f18-9dd7-767dd149c8e0', '9c116245-3a0f-51ee-9f8c-61aec3388e31', '70121328-f669-5fab-91b5-f5cec9fde031', '495964f4-f59c-54d5-a6a7-96f3108e0763', 30, 30, 'g'),
  ('75e49709-fec1-5ed3-b761-b38c900ffad7', '9c116245-3a0f-51ee-9f8c-61aec3388e31', '70121328-f669-5fab-91b5-f5cec9fde031', '2a1683a5-a292-5e88-b373-cf8d39b846be', 1, 1, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('1ef278cf-7e2c-5662-81f4-c86db7506392', '70121328-f669-5fab-91b5-f5cec9fde031', 0, 'Eier in einer Schüssel verquirlen und mit Salz würzen.'),
  ('7aa406cf-7e54-5a32-b967-0b234bce120b', '70121328-f669-5fab-91b5-f5cec9fde031', 1, 'Butter in einer Pfanne bei mittlerer Hitze schmelzen.'),
  ('f0244482-664c-55b1-8bd9-0342930ab282', '70121328-f669-5fab-91b5-f5cec9fde031', 2, 'Eier hineingeben und unter Rühren stocken lassen.'),
  ('f37bfb68-0b0b-57b2-a399-ed5be9a2fd5a', '70121328-f669-5fab-91b5-f5cec9fde031', 3, 'Gouda reiben, kurz vor Ende unterrühren und schmelzen lassen.')
on conflict (id) do nothing;

-- Overnight Oats mit Banane und Honig
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('da19a794-bfa8-5005-ac23-33e88444c4d4', 'Overnight Oats mit Banane und Honig', 5, 'easy', array['breakfast'], array['vegetarian'], 1, 20)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('aa605aa6-e90a-5323-8b55-9ee8b05d25b4', 'da19a794-bfa8-5005-ac23-33e88444c4d4', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('af997896-2f12-514b-b5e0-ba4610e51746', 'aa605aa6-e90a-5323-8b55-9ee8b05d25b4', 'da19a794-bfa8-5005-ac23-33e88444c4d4', '3552bd53-8e7d-59a2-9f35-97600b9e858d', 50, 50, 'g'),
  ('2cee497e-b047-5a83-beb2-59cb5077c942', 'aa605aa6-e90a-5323-8b55-9ee8b05d25b4', 'da19a794-bfa8-5005-ac23-33e88444c4d4', '822dcf16-0c0a-5e06-b473-e15521ae62ad', 120, 120, 'ml'),
  ('753c28aa-2358-5797-be39-2c41e7caee16', 'aa605aa6-e90a-5323-8b55-9ee8b05d25b4', 'da19a794-bfa8-5005-ac23-33e88444c4d4', '813d808a-ab08-590f-98d6-cfe4e2eef826', 100, 100, 'g'),
  ('63b236ac-d4eb-528f-8347-80971ad8bde0', 'aa605aa6-e90a-5323-8b55-9ee8b05d25b4', 'da19a794-bfa8-5005-ac23-33e88444c4d4', '5403b232-3d62-53ce-9515-d13982e70155', 60, 60, 'g'),
  ('fa80893b-3ca9-54de-ae98-5a6f2a1758c1', 'aa605aa6-e90a-5323-8b55-9ee8b05d25b4', 'da19a794-bfa8-5005-ac23-33e88444c4d4', '9fe8439d-9aec-5180-9370-c96a7fb8be23', 15, 15, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('af61fa36-a33d-5512-bed7-fcc3e00faec7', 'da19a794-bfa8-5005-ac23-33e88444c4d4', 0, 'Haferflocken, Milch und Joghurt in einem Glas verrühren.'),
  ('9cc37114-1457-561c-8d4d-6d976e5fcef6', 'da19a794-bfa8-5005-ac23-33e88444c4d4', 1, 'Banane in Scheiben schneiden und untermischen.'),
  ('aac0e1d3-e4e4-5b62-8a43-519c8783b978', 'da19a794-bfa8-5005-ac23-33e88444c4d4', 2, 'Mit Honig beträufeln und über Nacht im Kühlschrank ziehen lassen.')
on conflict (id) do nothing;

-- Klassische Pfannkuchen
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', 'Klassische Pfannkuchen', 20, 'easy', array['breakfast','brunch'], array['vegetarian'], 4, 30)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('9a1535a0-7ffd-5f2c-9492-9e30022446d4', '2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('d9447643-2b79-5edf-b530-68fad9a84d1d', '9a1535a0-7ffd-5f2c-9492-9e30022446d4', '2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', '7b419bb0-be87-5005-b0c6-4225c701d31d', 200, 200, 'g'),
  ('d88513be-95fb-5614-85b8-5db5b547fa15', '9a1535a0-7ffd-5f2c-9492-9e30022446d4', '2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', '822dcf16-0c0a-5e06-b473-e15521ae62ad', 300, 300, 'ml'),
  ('430447fa-be29-5700-9d6e-bbedfd145418', '9a1535a0-7ffd-5f2c-9492-9e30022446d4', '2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', '3581cf9f-a44e-5ded-8d50-3b185deda15a', 120, 2, 'piece'),
  ('79b5db8a-6206-5a20-9b0d-052c84a64eed', '9a1535a0-7ffd-5f2c-9492-9e30022446d4', '2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', 'd6a5a3dd-7f38-5627-8b30-e270a5a5fb96', 20, 20, 'g'),
  ('7c6062e8-db91-5af0-8089-33c7f397b618', '9a1535a0-7ffd-5f2c-9492-9e30022446d4', '2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', '9c1838fa-5ef3-58a4-a683-306cdcacc40e', 20, 20, 'g'),
  ('36027b0e-c5fd-541a-bff3-dacb242309df', '9a1535a0-7ffd-5f2c-9492-9e30022446d4', '2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', '2a1683a5-a292-5e88-b373-cf8d39b846be', 2, 2, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('0b121a4b-468d-5bdf-8d7f-8d4a4466da9c', '2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', 0, 'Mehl, Milch, Eier, Zucker und Salz zu einem glatten Teig verrühren.'),
  ('c8bd64ca-3dc7-54d0-b53b-d4fcec1ff3f5', '2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', 1, 'Butter in einer Pfanne erhitzen.'),
  ('56a17616-4635-54d7-8d5d-e5ca5ba6bc54', '2f569bd5-2c90-5b7c-bee1-7f94a2cf4f69', 2, 'Pro Pfannkuchen eine Kelle Teig in die Pfanne geben und von beiden Seiten goldbraun backen.')
on conflict (id) do nothing;

-- Bananen-Porridge
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('318a277c-4061-5ee9-8939-63839491ab4f', 'Bananen-Porridge', 10, 'easy', array['breakfast'], array['vegetarian'], 1, 40)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('8d2e7110-f1b5-5f20-9b02-8fe033dce0f5', '318a277c-4061-5ee9-8939-63839491ab4f', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('4110ed77-7fcc-5c9f-bf08-f91cc3aa39bc', '8d2e7110-f1b5-5f20-9b02-8fe033dce0f5', '318a277c-4061-5ee9-8939-63839491ab4f', '3552bd53-8e7d-59a2-9f35-97600b9e858d', 50, 50, 'g'),
  ('30572eb4-84c2-51cd-9387-3bdb3063e98a', '8d2e7110-f1b5-5f20-9b02-8fe033dce0f5', '318a277c-4061-5ee9-8939-63839491ab4f', '822dcf16-0c0a-5e06-b473-e15521ae62ad', 200, 200, 'ml'),
  ('a58378da-bbc7-544f-b32d-0c01fd0e952a', '8d2e7110-f1b5-5f20-9b02-8fe033dce0f5', '318a277c-4061-5ee9-8939-63839491ab4f', '5403b232-3d62-53ce-9515-d13982e70155', 60, 60, 'g'),
  ('7a1d0615-0161-5524-91fc-b2f9977f61b0', '8d2e7110-f1b5-5f20-9b02-8fe033dce0f5', '318a277c-4061-5ee9-8939-63839491ab4f', '9fe8439d-9aec-5180-9370-c96a7fb8be23', 10, 10, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('2ded4375-faf8-546b-a0e2-9abc56f239e1', '318a277c-4061-5ee9-8939-63839491ab4f', 0, 'Haferflocken mit Milch in einem Topf aufkochen und bei niedriger Hitze quellen lassen.'),
  ('a266ae14-1887-5fa4-a08b-06651b142ff7', '318a277c-4061-5ee9-8939-63839491ab4f', 1, 'Banane zerdrücken und unterrühren.'),
  ('53dc8297-aeec-5551-9b61-cafb64eebd7c', '318a277c-4061-5ee9-8939-63839491ab4f', 2, 'Mit Honig süßen und servieren.')
on conflict (id) do nothing;

-- Joghurt mit Apfel und Honig
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('e78f5944-54ab-5ab4-b0f3-f3806a68c90d', 'Joghurt mit Apfel und Honig', 5, 'easy', array['breakfast','snack'], array['vegetarian'], 1, 50)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('1e2a3377-3402-50f5-9bf8-d8c8fc8dccdd', 'e78f5944-54ab-5ab4-b0f3-f3806a68c90d', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('ce5ea274-99b6-5f86-8944-90045b000b98', '1e2a3377-3402-50f5-9bf8-d8c8fc8dccdd', 'e78f5944-54ab-5ab4-b0f3-f3806a68c90d', '813d808a-ab08-590f-98d6-cfe4e2eef826', 150, 150, 'g'),
  ('5242a08a-8472-5960-9f35-835f80212fca', '1e2a3377-3402-50f5-9bf8-d8c8fc8dccdd', 'e78f5944-54ab-5ab4-b0f3-f3806a68c90d', 'd8fa049a-69b6-5519-bad9-5df38dbb11f0', 100, 100, 'g'),
  ('0d79d9ab-4c43-5e58-b3a8-8f45e1e3be3d', '1e2a3377-3402-50f5-9bf8-d8c8fc8dccdd', 'e78f5944-54ab-5ab4-b0f3-f3806a68c90d', '9fe8439d-9aec-5180-9370-c96a7fb8be23', 15, 15, 'g'),
  ('508e68c4-8c91-5ca6-b75f-cded7c6e6680', '1e2a3377-3402-50f5-9bf8-d8c8fc8dccdd', 'e78f5944-54ab-5ab4-b0f3-f3806a68c90d', '3552bd53-8e7d-59a2-9f35-97600b9e858d', 20, 20, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('b6a8528c-3065-5d3d-b7cb-56fd48d8aa42', 'e78f5944-54ab-5ab4-b0f3-f3806a68c90d', 0, 'Apfel waschen, entkernen und würfeln.'),
  ('a4c9da9b-1f3a-573d-9f0e-cedfcce7a2a7', 'e78f5944-54ab-5ab4-b0f3-f3806a68c90d', 1, 'Joghurt in eine Schale geben, Apfelwürfel und Haferflocken darüber verteilen.'),
  ('0437dd9b-5323-54b3-839a-e2529f082d1f', 'e78f5944-54ab-5ab4-b0f3-f3806a68c90d', 2, 'Mit Honig beträufeln.')
on conflict (id) do nothing;

-- Spaghetti Bolognese
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('8d4bae92-90b5-5150-8647-2a96e5c38b7f', 'Spaghetti Bolognese', 35, 'medium', array['dinner','lunch'], '{}', 4, 60)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('dea9cfa2-1758-5362-bdcd-7f9f6d76edca', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('036b118b-b1a0-5fa2-be4a-e353e84d8fc9', 'dea9cfa2-1758-5362-bdcd-7f9f6d76edca', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', '869764ff-4322-5315-b401-d69d0da91252', 400, 400, 'g'),
  ('11515d71-dfe0-552d-a813-46424d4f74e2', 'dea9cfa2-1758-5362-bdcd-7f9f6d76edca', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', '1435bd1e-16b7-5b61-af7b-ba896491d677', 400, 400, 'g'),
  ('53e4340a-33ac-51eb-9cd5-91a050fa7d12', 'dea9cfa2-1758-5362-bdcd-7f9f6d76edca', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', '9769015e-92ed-54c9-bc23-f6a5677e8338', 400, 400, 'g'),
  ('4118f0f5-9049-516e-95f7-a694bb63c6d1', 'dea9cfa2-1758-5362-bdcd-7f9f6d76edca', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', '7bd2cd4c-5c95-55d4-b6f6-6fdc15bacd04', 40, 40, 'g'),
  ('84751539-5943-5a71-8aea-b219ae7277ab', 'dea9cfa2-1758-5362-bdcd-7f9f6d76edca', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', '669fa5f9-cfe3-5c78-af75-964c9326efd8', 80, 80, 'g'),
  ('2c121303-c458-5e17-94a6-c2077b6937ff', 'dea9cfa2-1758-5362-bdcd-7f9f6d76edca', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', '2d5e8b74-f732-5ebb-bb29-87ad85bae5ea', 10, 10, 'g'),
  ('b7fab2bb-4267-5362-bffc-4d78c23d3b6c', 'dea9cfa2-1758-5362-bdcd-7f9f6d76edca', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 20, 20, 'g'),
  ('5044a973-a50d-5ea0-9487-e489822ef22c', 'dea9cfa2-1758-5362-bdcd-7f9f6d76edca', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', '2a1683a5-a292-5e88-b373-cf8d39b846be', 3, 3, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('7dbfca9f-5cce-5b7f-aa15-f130b339ba27', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', 0, 'Zwiebel und Knoblauch fein würfeln, in Olivenöl glasig anschwitzen.'),
  ('5c898526-ba7f-5161-94f7-2893539be34b', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', 1, 'Hackfleisch dazugeben und krümelig anbraten.'),
  ('9e755fa6-4168-553b-b802-a0c6a8637cda', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', 2, 'Tomatenmark kurz mitrösten, dann gehackte Tomaten zugießen.'),
  ('668a364c-ad01-5f0f-89cb-ea4dcef96673', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', 3, 'Sauce 20 Minuten köcheln lassen, mit Salz abschmecken.'),
  ('b36a3d08-fcbf-5386-857c-4ba6fd373719', '8d4bae92-90b5-5150-8647-2a96e5c38b7f', 4, 'Spaghetti in Salzwasser bissfest kochen, abgießen und mit der Sauce servieren.')
on conflict (id) do nothing;

-- Chili con Carne
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('c1568e2d-fffa-5501-8251-e24eebb082ed', 'Chili con Carne', 40, 'medium', array['dinner'], '{}', 4, 70)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('5504412e-a8aa-5d87-9e6c-25721f0538f4', 'c1568e2d-fffa-5501-8251-e24eebb082ed', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('6a76d2e2-1b22-5b73-8c9d-66156e377955', '5504412e-a8aa-5d87-9e6c-25721f0538f4', 'c1568e2d-fffa-5501-8251-e24eebb082ed', '1435bd1e-16b7-5b61-af7b-ba896491d677', 400, 400, 'g'),
  ('1fbf8da2-6aa6-542d-90d4-90fa0400e575', '5504412e-a8aa-5d87-9e6c-25721f0538f4', 'c1568e2d-fffa-5501-8251-e24eebb082ed', 'bda3df30-7a7c-5909-a517-191a4a757d93', 400, 400, 'g'),
  ('009a324b-d869-5581-a35a-e8ab258d623e', '5504412e-a8aa-5d87-9e6c-25721f0538f4', 'c1568e2d-fffa-5501-8251-e24eebb082ed', '9769015e-92ed-54c9-bc23-f6a5677e8338', 400, 400, 'g'),
  ('17b4a912-d78a-554b-a475-12b1ced0cc38', '5504412e-a8aa-5d87-9e6c-25721f0538f4', 'c1568e2d-fffa-5501-8251-e24eebb082ed', '7bd2cd4c-5c95-55d4-b6f6-6fdc15bacd04', 30, 30, 'g'),
  ('71c9b185-9fbf-58f7-b1b7-1aa5660c5aae', '5504412e-a8aa-5d87-9e6c-25721f0538f4', 'c1568e2d-fffa-5501-8251-e24eebb082ed', '669fa5f9-cfe3-5c78-af75-964c9326efd8', 80, 80, 'g'),
  ('b5a096b4-9f09-5e67-b885-6156593d130a', '5504412e-a8aa-5d87-9e6c-25721f0538f4', 'c1568e2d-fffa-5501-8251-e24eebb082ed', 'd1d42080-0a0d-5388-90cf-49d775108306', 150, 150, 'g'),
  ('6515696c-82e9-51c5-8da5-8a52acaadaee', '5504412e-a8aa-5d87-9e6c-25721f0538f4', 'c1568e2d-fffa-5501-8251-e24eebb082ed', '2d5e8b74-f732-5ebb-bb29-87ad85bae5ea', 10, 10, 'g'),
  ('082d48f5-efb7-52cd-a65f-2be594f59cd1', '5504412e-a8aa-5d87-9e6c-25721f0538f4', 'c1568e2d-fffa-5501-8251-e24eebb082ed', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 20, 20, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('6fad0c2f-8712-5336-a7e7-21c226f73ede', 'c1568e2d-fffa-5501-8251-e24eebb082ed', 0, 'Zwiebel, Knoblauch und Paprika würfeln.'),
  ('c4f56cd7-8e25-5872-ab28-c0333406a19f', 'c1568e2d-fffa-5501-8251-e24eebb082ed', 1, 'Hackfleisch in Olivenöl anbraten, Zwiebel, Knoblauch und Paprika zugeben und mitbraten.'),
  ('a8ccab71-2c7b-5801-8f66-9c5784547b76', 'c1568e2d-fffa-5501-8251-e24eebb082ed', 2, 'Tomatenmark, gehackte Tomaten und Kidneybohnen dazugeben.'),
  ('3a49e182-a71d-5fb9-b1c6-16b6738175c4', 'c1568e2d-fffa-5501-8251-e24eebb082ed', 3, 'Alles 25 Minuten köcheln lassen.')
on conflict (id) do nothing;

-- Hähnchen-Gemüse-Pfanne mit Reis
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('c500d69e-a639-5705-86ef-8a3096d8ffd3', 'Hähnchen-Gemüse-Pfanne mit Reis', 30, 'medium', array['dinner'], '{}', 3, 80)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('bfeb6343-cbca-5ddc-befc-8862aa538849', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('1555e215-378b-5368-9c14-c50c18a3ba8d', 'bfeb6343-cbca-5ddc-befc-8862aa538849', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', '617e05e0-ad69-5a19-8fd3-225a56b33fd3', 400, 400, 'g'),
  ('2cf09bd7-74f5-5c3a-b294-c8da5e8ea2cd', 'bfeb6343-cbca-5ddc-befc-8862aa538849', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', 'd1d42080-0a0d-5388-90cf-49d775108306', 150, 150, 'g'),
  ('4666f2f3-5aa9-55f0-9959-b762690a0f64', 'bfeb6343-cbca-5ddc-befc-8862aa538849', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', '669fa5f9-cfe3-5c78-af75-964c9326efd8', 80, 80, 'g'),
  ('2fe494c1-c9d3-50aa-bed1-f6da0aebbb79', 'bfeb6343-cbca-5ddc-befc-8862aa538849', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', '297f392c-c806-5f90-b2b2-b2b54d055ca7', 120, 120, 'g'),
  ('53467511-20d5-533f-b4db-6ecd0729ac85', 'bfeb6343-cbca-5ddc-befc-8862aa538849', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', 'e06b83d6-c3a4-583b-a36a-57c2fc699eba', 240, 240, 'g'),
  ('0dcb498f-92c4-5d8c-813e-06d1607ed754', 'bfeb6343-cbca-5ddc-befc-8862aa538849', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 20, 20, 'g'),
  ('81bea04e-3e24-574d-bda7-4d6e0c78c027', 'bfeb6343-cbca-5ddc-befc-8862aa538849', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', 'fde39f28-ffd1-57d2-a2dc-7f6fb42bfb92', 20, 20, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('d4bff347-5243-5515-a1d8-32e2b705ac92', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', 0, 'Reis nach Packungsangabe kochen.'),
  ('2b4a74e3-178e-589e-b407-032fc8960fa1', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', 1, 'Hähnchenbrust in Streifen schneiden, Gemüse würfeln.'),
  ('7fbf7941-430c-56a6-8df2-0b4f33215eee', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', 2, 'Hähnchen in Olivenöl anbraten, Gemüse dazugeben und mitbraten.'),
  ('44b0c235-96fc-5ee6-823b-79608fafecee', 'c500d69e-a639-5705-86ef-8a3096d8ffd3', 3, 'Mit Sojasauce ablöschen und kurz köcheln lassen, mit Reis servieren.')
on conflict (id) do nothing;

-- Kichererbsen-Curry
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('4d77f981-c9da-5ead-8de1-20b18b5f90bd', 'Kichererbsen-Curry', 30, 'easy', array['dinner','lunch'], array['vegetarian'], 3, 90)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('1b9c235c-7dba-523b-9261-08d04f875ba6', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('45e7991f-ed95-516f-ab4f-a38170290fae', '1b9c235c-7dba-523b-9261-08d04f875ba6', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', '8c8b2a6e-1cc8-56fa-bc80-3022ed2a4807', 400, 400, 'g'),
  ('771b9ba8-0086-5758-9309-de1452f63cd3', '1b9c235c-7dba-523b-9261-08d04f875ba6', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', '9769015e-92ed-54c9-bc23-f6a5677e8338', 400, 400, 'g'),
  ('f966eb64-c74a-5663-b520-3cdb8d531c8e', '1b9c235c-7dba-523b-9261-08d04f875ba6', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', '669fa5f9-cfe3-5c78-af75-964c9326efd8', 80, 80, 'g'),
  ('1db3a254-12b1-5c86-9036-3e71357fd386', '1b9c235c-7dba-523b-9261-08d04f875ba6', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', '2d5e8b74-f732-5ebb-bb29-87ad85bae5ea', 10, 10, 'g'),
  ('18a017ec-b3f5-5ea9-a29a-449a860a2c27', '1b9c235c-7dba-523b-9261-08d04f875ba6', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', '297f392c-c806-5f90-b2b2-b2b54d055ca7', 100, 100, 'g'),
  ('b51a2568-9e73-5ce4-8d21-8eb2aacf3f7e', '1b9c235c-7dba-523b-9261-08d04f875ba6', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 20, 20, 'g'),
  ('e29b6912-74a8-5a8d-a89a-3f3ca3f0f783', '1b9c235c-7dba-523b-9261-08d04f875ba6', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', 'e06b83d6-c3a4-583b-a36a-57c2fc699eba', 200, 200, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('14206f20-6e4f-5a90-a68c-02999d4e74c2', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', 0, 'Zwiebel, Knoblauch und Karotte würfeln, in Olivenöl anschwitzen.'),
  ('4b1cbe93-c434-58b1-9ac2-f22e4f5506ed', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', 1, 'Gehackte Tomaten und Kichererbsen dazugeben.'),
  ('f2d0f27a-6135-57e0-9d5e-b2bd3f5247f0', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', 2, '20 Minuten köcheln lassen.'),
  ('65900097-7e2f-5bee-8c47-543ffa055a95', '4d77f981-c9da-5ead-8de1-20b18b5f90bd', 3, 'Mit gekochtem Reis servieren.')
on conflict (id) do nothing;

-- Couscous-Salat mit Kichererbsen
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('02c72ddc-c99d-5a8f-8a24-db7808a5b87d', 'Couscous-Salat mit Kichererbsen', 20, 'easy', array['lunch'], array['vegetarian'], 3, 100)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('031a9e0f-1dcb-5951-b2fc-73e2771482a5', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('5078d02c-4cc9-597c-a32e-9bffe0346eb2', '031a9e0f-1dcb-5951-b2fc-73e2771482a5', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', '252abf91-4135-5164-98f7-0342d7097fd0', 200, 200, 'g'),
  ('fac55b60-cfb2-5252-ba98-8cc691b40c1f', '031a9e0f-1dcb-5951-b2fc-73e2771482a5', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', '8c8b2a6e-1cc8-56fa-bc80-3022ed2a4807', 240, 240, 'g'),
  ('9bfea781-d090-53bb-9855-661c2856848e', '031a9e0f-1dcb-5951-b2fc-73e2771482a5', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', 'd1d42080-0a0d-5388-90cf-49d775108306', 100, 100, 'g'),
  ('5e4aac74-881f-5e8c-94cc-f762ad8f7142', '031a9e0f-1dcb-5951-b2fc-73e2771482a5', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', '669fa5f9-cfe3-5c78-af75-964c9326efd8', 40, 40, 'g'),
  ('9880f600-a81b-57b1-a706-fd0faf81c046', '031a9e0f-1dcb-5951-b2fc-73e2771482a5', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', '84197347-44c0-5620-90f8-f6b2a27054f7', 30, 30, 'g'),
  ('3045b852-00f3-57fe-94b3-ddd3b54b8943', '031a9e0f-1dcb-5951-b2fc-73e2771482a5', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 20, 20, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('b8268445-aaf0-5d31-a9c5-8a15ca87d928', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', 0, 'Couscous nach Packungsangabe mit heißem Wasser quellen lassen.'),
  ('3af8a41d-d4e1-5347-9313-4627cf74a467', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', 1, 'Paprika und Zwiebel fein würfeln.'),
  ('6235709e-2531-5039-af91-2ba40e96c507', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', 2, 'Kichererbsen, Paprika und Zwiebel unter den Couscous mischen.'),
  ('24e1d456-20f1-59ca-8ac8-151c8d497ff6', '02c72ddc-c99d-5a8f-8a24-db7808a5b87d', 3, 'Mit Zitronensaft und Olivenöl abschmecken.')
on conflict (id) do nothing;

-- Linsen-Eintopf
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('2c994ead-c7f8-5de8-a15c-41f88b57612a', 'Linsen-Eintopf', 35, 'easy', array['lunch','dinner'], array['vegetarian'], 4, 110)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('206b023c-6746-5c8a-b9f6-cb6ff307f374', '2c994ead-c7f8-5de8-a15c-41f88b57612a', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('328a98ac-c86d-515b-8228-050c3963bfd2', '206b023c-6746-5c8a-b9f6-cb6ff307f374', '2c994ead-c7f8-5de8-a15c-41f88b57612a', 'b1210958-463a-585d-9c5d-373cc45981dc', 250, 250, 'g'),
  ('3a80dc51-594c-5fe6-809a-fbf2c84fac63', '206b023c-6746-5c8a-b9f6-cb6ff307f374', '2c994ead-c7f8-5de8-a15c-41f88b57612a', '297f392c-c806-5f90-b2b2-b2b54d055ca7', 150, 150, 'g'),
  ('0f3228ad-f404-518c-a8f2-3a4531c55cde', '206b023c-6746-5c8a-b9f6-cb6ff307f374', '2c994ead-c7f8-5de8-a15c-41f88b57612a', '669fa5f9-cfe3-5c78-af75-964c9326efd8', 80, 80, 'g'),
  ('effb45b8-7835-5fcd-8d24-7fb09bebc102', '206b023c-6746-5c8a-b9f6-cb6ff307f374', '2c994ead-c7f8-5de8-a15c-41f88b57612a', '061b09fe-9c2a-5a23-94c8-1c610861159f', 200, 200, 'g'),
  ('f77c39fd-9da0-5973-9afc-22a5c5ad53b2', '206b023c-6746-5c8a-b9f6-cb6ff307f374', '2c994ead-c7f8-5de8-a15c-41f88b57612a', '2d5e8b74-f732-5ebb-bb29-87ad85bae5ea', 10, 10, 'g'),
  ('704d7845-417c-546b-a8db-2d4a096fd60f', '206b023c-6746-5c8a-b9f6-cb6ff307f374', '2c994ead-c7f8-5de8-a15c-41f88b57612a', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 20, 20, 'g'),
  ('c9b72dc8-79a8-5012-9843-ff04d84356b3', '206b023c-6746-5c8a-b9f6-cb6ff307f374', '2c994ead-c7f8-5de8-a15c-41f88b57612a', '2a1683a5-a292-5e88-b373-cf8d39b846be', 3, 3, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('35f843e3-be9a-501a-8ae3-cd5ab95d693b', '2c994ead-c7f8-5de8-a15c-41f88b57612a', 0, 'Zwiebel, Karotte und Kartoffel würfeln.'),
  ('65715216-af09-5169-9f31-4a52b51b97cf', '2c994ead-c7f8-5de8-a15c-41f88b57612a', 1, 'Alles zusammen mit den Linsen und Knoblauch in Olivenöl kurz anschwitzen.'),
  ('82e349f5-03ba-5beb-83be-87b091d81f79', '2c994ead-c7f8-5de8-a15c-41f88b57612a', 2, 'Mit Wasser bedeckt aufkochen und 25 Minuten köcheln lassen.'),
  ('f311ed89-9fb5-56a0-a244-2858c231c4fb', '2c994ead-c7f8-5de8-a15c-41f88b57612a', 3, 'Mit Salz abschmecken.')
on conflict (id) do nothing;

-- Kartoffel-Gulasch
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('3d325d09-a191-5957-b067-739db2dc14b4', 'Kartoffel-Gulasch', 45, 'medium', array['dinner'], '{}', 4, 120)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('bc1482f5-8da5-5ff6-a270-1e5a7837d3c7', '3d325d09-a191-5957-b067-739db2dc14b4', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('04bead93-c6d0-504c-bb07-58054d69b5cd', 'bc1482f5-8da5-5ff6-a270-1e5a7837d3c7', '3d325d09-a191-5957-b067-739db2dc14b4', '061b09fe-9c2a-5a23-94c8-1c610861159f', 500, 500, 'g'),
  ('5e17b9b3-d1cf-53a2-a9cf-f1a31af15e46', 'bc1482f5-8da5-5ff6-a270-1e5a7837d3c7', '3d325d09-a191-5957-b067-739db2dc14b4', '1435bd1e-16b7-5b61-af7b-ba896491d677', 300, 300, 'g'),
  ('c1a16d76-ec89-5839-99a8-9fde70edd7d5', 'bc1482f5-8da5-5ff6-a270-1e5a7837d3c7', '3d325d09-a191-5957-b067-739db2dc14b4', '669fa5f9-cfe3-5c78-af75-964c9326efd8', 100, 100, 'g'),
  ('e9ec0273-31d1-5ef5-be39-e469da400016', 'bc1482f5-8da5-5ff6-a270-1e5a7837d3c7', '3d325d09-a191-5957-b067-739db2dc14b4', 'd1d42080-0a0d-5388-90cf-49d775108306', 150, 150, 'g'),
  ('907e8004-f757-5187-82cf-dda56715b869', 'bc1482f5-8da5-5ff6-a270-1e5a7837d3c7', '3d325d09-a191-5957-b067-739db2dc14b4', '7bd2cd4c-5c95-55d4-b6f6-6fdc15bacd04', 30, 30, 'g'),
  ('f319a184-f35b-5056-af50-2c7d0fd00749', 'bc1482f5-8da5-5ff6-a270-1e5a7837d3c7', '3d325d09-a191-5957-b067-739db2dc14b4', '2d5e8b74-f732-5ebb-bb29-87ad85bae5ea', 10, 10, 'g'),
  ('3ae3f8ae-f4d4-5d97-b46f-ac6c433f898f', 'bc1482f5-8da5-5ff6-a270-1e5a7837d3c7', '3d325d09-a191-5957-b067-739db2dc14b4', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 20, 20, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('c3f846c8-ab83-5a77-95f1-75dac2ef5979', '3d325d09-a191-5957-b067-739db2dc14b4', 0, 'Zwiebel und Knoblauch würfeln, Hackfleisch darin anbraten.'),
  ('14b3346a-e8e1-5127-92bd-2ae0e41ccd00', '3d325d09-a191-5957-b067-739db2dc14b4', 1, 'Paprika und Kartoffelwürfel dazugeben.'),
  ('1b3d689b-1550-5a8b-a8bd-7e0c9121d419', '3d325d09-a191-5957-b067-739db2dc14b4', 2, 'Tomatenmark einrühren, mit Wasser aufgießen.'),
  ('84a6ee5d-8640-5386-abf5-12218498c492', '3d325d09-a191-5957-b067-739db2dc14b4', 3, '30 Minuten köcheln lassen, bis die Kartoffeln gar sind.')
on conflict (id) do nothing;

-- Thunfisch-Couscous-Salat
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('7d568089-e4ef-5826-87c2-f18b03958463', 'Thunfisch-Couscous-Salat', 20, 'easy', array['lunch'], '{}', 2, 130)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('0e33d01b-5652-559e-85aa-259e1a942208', '7d568089-e4ef-5826-87c2-f18b03958463', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('c8096c38-d672-5c16-aa60-2e60d7a74a58', '0e33d01b-5652-559e-85aa-259e1a942208', '7d568089-e4ef-5826-87c2-f18b03958463', '252abf91-4135-5164-98f7-0342d7097fd0', 150, 150, 'g'),
  ('bbcbbb2f-1b89-52d2-b2ca-a0d4f2c72909', '0e33d01b-5652-559e-85aa-259e1a942208', '7d568089-e4ef-5826-87c2-f18b03958463', '3404fb06-6463-5457-98bf-11129c261d6d', 160, 160, 'g'),
  ('196c82b0-3e75-56a3-a824-59463643b03d', '0e33d01b-5652-559e-85aa-259e1a942208', '7d568089-e4ef-5826-87c2-f18b03958463', 'd1d42080-0a0d-5388-90cf-49d775108306', 100, 100, 'g'),
  ('3a07f9d8-16c9-5f8d-bcdb-04943e8fcef9', '0e33d01b-5652-559e-85aa-259e1a942208', '7d568089-e4ef-5826-87c2-f18b03958463', '669fa5f9-cfe3-5c78-af75-964c9326efd8', 40, 40, 'g'),
  ('44ec039d-d1ae-53bf-aa07-2a5acf509fc3', '0e33d01b-5652-559e-85aa-259e1a942208', '7d568089-e4ef-5826-87c2-f18b03958463', '84197347-44c0-5620-90f8-f6b2a27054f7', 20, 20, 'g'),
  ('d9275e3f-d425-5428-a3b9-3c97b47456ba', '0e33d01b-5652-559e-85aa-259e1a942208', '7d568089-e4ef-5826-87c2-f18b03958463', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 15, 15, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('cf00ed9f-2363-521d-8c6e-4cfb8068fc24', '7d568089-e4ef-5826-87c2-f18b03958463', 0, 'Couscous mit heißem Wasser quellen lassen.'),
  ('51ecebf1-6c88-510d-af75-a57b48073250', '7d568089-e4ef-5826-87c2-f18b03958463', 1, 'Paprika und Zwiebel fein würfeln.'),
  ('f1e2073f-ce52-519d-967f-48e6f6c030a1', '7d568089-e4ef-5826-87c2-f18b03958463', 2, 'Thunfisch abtropfen lassen und unter den Couscous mischen.'),
  ('3eba78a7-1e16-5560-b1e1-18c25fca1130', '7d568089-e4ef-5826-87c2-f18b03958463', 3, 'Mit Zitronensaft und Olivenöl abschmecken.')
on conflict (id) do nothing;

-- Hähnchen-Schnitzel mit Kartoffeln
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', 'Hähnchen-Schnitzel mit Kartoffeln', 35, 'medium', array['dinner'], '{}', 2, 140)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('69256b0c-30c7-5fd6-8dea-55ded80278b0', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('3dda7f6c-b218-5130-bfc6-65a7d395eb4c', '69256b0c-30c7-5fd6-8dea-55ded80278b0', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', '617e05e0-ad69-5a19-8fd3-225a56b33fd3', 300, 300, 'g'),
  ('8ee1f117-e550-51c5-82c0-1b9e044b83d6', '69256b0c-30c7-5fd6-8dea-55ded80278b0', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', '986090c4-abd3-51ab-83cf-485d6d30374b', 60, 60, 'g'),
  ('d3c4061e-aa4f-523e-814b-8ed7110d3bda', '69256b0c-30c7-5fd6-8dea-55ded80278b0', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', '3581cf9f-a44e-5ded-8d50-3b185deda15a', 60, 1, 'piece'),
  ('e61feb20-78a2-5538-840b-025a4d5a0a55', '69256b0c-30c7-5fd6-8dea-55ded80278b0', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', '7b419bb0-be87-5005-b0c6-4225c701d31d', 40, 40, 'g'),
  ('d7b38aed-49d3-5117-a01b-f4a60fe1835c', '69256b0c-30c7-5fd6-8dea-55ded80278b0', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', '061b09fe-9c2a-5a23-94c8-1c610861159f', 400, 400, 'g'),
  ('22bc28af-afbb-5d98-b19a-6a5a3a2bc07f', '69256b0c-30c7-5fd6-8dea-55ded80278b0', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', '9c1838fa-5ef3-58a4-a683-306cdcacc40e', 20, 20, 'g'),
  ('0ba5732e-b4fa-5db1-a13b-ea97e1a5509f', '69256b0c-30c7-5fd6-8dea-55ded80278b0', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', '2a1683a5-a292-5e88-b373-cf8d39b846be', 3, 3, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('f8a024e6-4e53-565d-81dd-ab4869d6c098', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', 0, 'Kartoffeln schälen, würfeln und in Salzwasser kochen.'),
  ('9df0405e-b6b8-5e9a-bab9-a68a0fb5b8d4', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', 1, 'Hähnchenbrust flach klopfen, in Mehl, verquirltem Ei und Paniermehl wenden.'),
  ('c7440a76-3799-54b3-a201-c76ad996a788', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', 2, 'In Butter goldbraun braten.'),
  ('ced05092-f247-5b8e-8f52-ead39198b2d5', 'c0e8a39d-fece-5aab-9e1a-ee6173f9dd2b', 3, 'Mit den Kartoffeln servieren.')
on conflict (id) do nothing;

-- Gemüse-Reispfanne
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('62ef23d2-9375-5b25-91c1-ec23ca91e056', 'Gemüse-Reispfanne', 25, 'easy', array['dinner','lunch'], array['vegetarian'], 3, 150)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('5afaf59a-a37d-5bab-ae16-78d5f92686dc', '62ef23d2-9375-5b25-91c1-ec23ca91e056', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('de18c784-df2f-561a-8822-440a4e00ecec', '5afaf59a-a37d-5bab-ae16-78d5f92686dc', '62ef23d2-9375-5b25-91c1-ec23ca91e056', 'e06b83d6-c3a4-583b-a36a-57c2fc699eba', 240, 240, 'g'),
  ('d4f3bd5c-7aa2-5b47-8888-d1b71e33b1b1', '5afaf59a-a37d-5bab-ae16-78d5f92686dc', '62ef23d2-9375-5b25-91c1-ec23ca91e056', 'd1d42080-0a0d-5388-90cf-49d775108306', 120, 120, 'g'),
  ('8a5258e1-b816-583f-88f7-3e32b926d4ad', '5afaf59a-a37d-5bab-ae16-78d5f92686dc', '62ef23d2-9375-5b25-91c1-ec23ca91e056', '297f392c-c806-5f90-b2b2-b2b54d055ca7', 100, 100, 'g'),
  ('46f0db5d-c498-5137-83e8-92a69713e62d', '5afaf59a-a37d-5bab-ae16-78d5f92686dc', '62ef23d2-9375-5b25-91c1-ec23ca91e056', '669fa5f9-cfe3-5c78-af75-964c9326efd8', 60, 60, 'g'),
  ('d0d6ad21-ef43-5b40-82c0-6631b1536ece', '5afaf59a-a37d-5bab-ae16-78d5f92686dc', '62ef23d2-9375-5b25-91c1-ec23ca91e056', '8c8b2a6e-1cc8-56fa-bc80-3022ed2a4807', 200, 200, 'g'),
  ('b3d974a9-9a34-52e5-a294-9aed430e5221', '5afaf59a-a37d-5bab-ae16-78d5f92686dc', '62ef23d2-9375-5b25-91c1-ec23ca91e056', 'fde39f28-ffd1-57d2-a2dc-7f6fb42bfb92', 20, 20, 'g'),
  ('e80ef5da-aeb4-5284-9afe-e8f734742b12', '5afaf59a-a37d-5bab-ae16-78d5f92686dc', '62ef23d2-9375-5b25-91c1-ec23ca91e056', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 15, 15, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('141521cd-d06d-5bd2-8ed3-69e7b739a908', '62ef23d2-9375-5b25-91c1-ec23ca91e056', 0, 'Reis nach Packungsangabe kochen.'),
  ('e8beecfd-6495-517d-b0e7-8f97ab953f49', '62ef23d2-9375-5b25-91c1-ec23ca91e056', 1, 'Gemüse würfeln und in Olivenöl anbraten.'),
  ('0966aad1-82c5-5e61-ac92-cbb6ca05f01d', '62ef23d2-9375-5b25-91c1-ec23ca91e056', 2, 'Kichererbsen und Reis dazugeben, mit Sojasauce abschmecken.')
on conflict (id) do nothing;

-- Frischkäse-Dip mit Paprika
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('e7a4f5e4-805f-5054-ae3a-272e4d9bcd5f', 'Frischkäse-Dip mit Paprika', 10, 'easy', array['snack','appetizer'], array['vegetarian'], 4, 160)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('a4c0e901-31a7-5f43-8686-f6a2cdaab3fe', 'e7a4f5e4-805f-5054-ae3a-272e4d9bcd5f', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('d34d8eca-1a8e-59ff-b469-bfe3c7b420f0', 'a4c0e901-31a7-5f43-8686-f6a2cdaab3fe', 'e7a4f5e4-805f-5054-ae3a-272e4d9bcd5f', 'f71ec39a-f5b9-5b49-98d5-f337cd6ace83', 200, 200, 'g'),
  ('4f61b170-2d5b-5a7a-a715-9ebbc6b0ef21', 'a4c0e901-31a7-5f43-8686-f6a2cdaab3fe', 'e7a4f5e4-805f-5054-ae3a-272e4d9bcd5f', 'd1d42080-0a0d-5388-90cf-49d775108306', 100, 100, 'g'),
  ('cc096f7b-b665-5d48-94dc-6d1e2f76b500', 'a4c0e901-31a7-5f43-8686-f6a2cdaab3fe', 'e7a4f5e4-805f-5054-ae3a-272e4d9bcd5f', '2d5e8b74-f732-5ebb-bb29-87ad85bae5ea', 5, 5, 'g'),
  ('cfca2de8-f8a7-5839-85eb-f6b24c65a0fb', 'a4c0e901-31a7-5f43-8686-f6a2cdaab3fe', 'e7a4f5e4-805f-5054-ae3a-272e4d9bcd5f', '2a1683a5-a292-5e88-b373-cf8d39b846be', 1, 1, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('4d591b88-4a4e-5116-8a0b-9b143b6131e8', 'e7a4f5e4-805f-5054-ae3a-272e4d9bcd5f', 0, 'Paprika fein würfeln, Knoblauch fein hacken.'),
  ('5f511f16-ab07-55ae-a368-586f7a95dd67', 'e7a4f5e4-805f-5054-ae3a-272e4d9bcd5f', 1, 'Beides mit dem Frischkäse verrühren.'),
  ('b7193e33-ac67-5575-9af6-866c5a621331', 'e7a4f5e4-805f-5054-ae3a-272e4d9bcd5f', 2, 'Mit Salz abschmecken und kaltstellen.')
on conflict (id) do nothing;

-- Honig-Joghurt mit Haferflocken
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('7bfde7e2-17d6-5d57-8ee5-715e653c3347', 'Honig-Joghurt mit Haferflocken', 5, 'easy', array['snack','dessert'], array['vegetarian'], 1, 170)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('b963cd21-60a1-5c54-9a63-86a32d1c93a4', '7bfde7e2-17d6-5d57-8ee5-715e653c3347', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('a671b3ad-4e9e-5556-96f8-1402e2337482', 'b963cd21-60a1-5c54-9a63-86a32d1c93a4', '7bfde7e2-17d6-5d57-8ee5-715e653c3347', '813d808a-ab08-590f-98d6-cfe4e2eef826', 150, 150, 'g'),
  ('b596dee4-d892-5f00-94c6-50920be29cb3', 'b963cd21-60a1-5c54-9a63-86a32d1c93a4', '7bfde7e2-17d6-5d57-8ee5-715e653c3347', '9fe8439d-9aec-5180-9370-c96a7fb8be23', 20, 20, 'g'),
  ('de0c32bb-f514-5d00-93aa-97b50ce47dac', 'b963cd21-60a1-5c54-9a63-86a32d1c93a4', '7bfde7e2-17d6-5d57-8ee5-715e653c3347', '3552bd53-8e7d-59a2-9f35-97600b9e858d', 30, 30, 'g'),
  ('a847880e-503d-52c5-ad6e-0e3252477c5e', 'b963cd21-60a1-5c54-9a63-86a32d1c93a4', '7bfde7e2-17d6-5d57-8ee5-715e653c3347', 'd8fa049a-69b6-5519-bad9-5df38dbb11f0', 60, 60, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('f95a5319-ebbb-57cd-9acc-b88e896acae4', '7bfde7e2-17d6-5d57-8ee5-715e653c3347', 0, 'Apfel würfeln.'),
  ('1e964171-66c8-5c71-bd3e-6f0fe455f5e2', '7bfde7e2-17d6-5d57-8ee5-715e653c3347', 1, 'Joghurt, Haferflocken und Apfel in einer Schale mischen.'),
  ('fcf8d219-ce75-56d4-b072-c888c3194302', '7bfde7e2-17d6-5d57-8ee5-715e653c3347', 2, 'Mit Honig beträufeln.')
on conflict (id) do nothing;

-- Geröstete Kichererbsen
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('077964e4-5011-568c-acef-b96c54f832d4', 'Geröstete Kichererbsen', 25, 'easy', array['snack'], array['vegetarian'], 4, 180)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('eea5d7b2-ff1b-5384-9221-b2f1df58e055', '077964e4-5011-568c-acef-b96c54f832d4', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('a4b60d1b-1413-55d0-9738-6dab1b11377a', 'eea5d7b2-ff1b-5384-9221-b2f1df58e055', '077964e4-5011-568c-acef-b96c54f832d4', '8c8b2a6e-1cc8-56fa-bc80-3022ed2a4807', 400, 400, 'g'),
  ('73f7ced3-e209-592c-b12c-578ae06d84d9', 'eea5d7b2-ff1b-5384-9221-b2f1df58e055', '077964e4-5011-568c-acef-b96c54f832d4', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 20, 20, 'g'),
  ('cb827d82-8be7-5109-89d7-3cea5d345871', 'eea5d7b2-ff1b-5384-9221-b2f1df58e055', '077964e4-5011-568c-acef-b96c54f832d4', '2a1683a5-a292-5e88-b373-cf8d39b846be', 3, 3, 'g'),
  ('1bcaf803-477a-5c78-ba56-da6fdbbc0c33', 'eea5d7b2-ff1b-5384-9221-b2f1df58e055', '077964e4-5011-568c-acef-b96c54f832d4', 'd1d42080-0a0d-5388-90cf-49d775108306', 60, 60, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('45247afe-bf1d-5d02-96ea-c301327a137b', '077964e4-5011-568c-acef-b96c54f832d4', 0, 'Kichererbsen abtropfen lassen und trocken tupfen.'),
  ('b1e4c920-e323-5d0e-a71a-77e6e463258d', '077964e4-5011-568c-acef-b96c54f832d4', 1, 'Mit Olivenöl, Salz und fein gewürfelter Paprika mischen.'),
  ('05518fe8-b5d3-5853-b4c4-80072dac2471', '077964e4-5011-568c-acef-b96c54f832d4', 2, 'Im Ofen bei 200°C ca. 20 Minuten knusprig rösten.')
on conflict (id) do nothing;

-- Bananenbrot
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('0b053108-709d-5a35-9171-28a7541d3a4b', 'Bananenbrot', 55, 'medium', array['dessert','breakfast'], array['vegetarian'], 8, 190)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('3ddf2d61-a533-570a-9824-d8caae250af0', '0b053108-709d-5a35-9171-28a7541d3a4b', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('c77535b0-4b1d-5e07-8570-07e8a875912e', '3ddf2d61-a533-570a-9824-d8caae250af0', '0b053108-709d-5a35-9171-28a7541d3a4b', '7b419bb0-be87-5005-b0c6-4225c701d31d', 250, 250, 'g'),
  ('26f35fd2-1f57-54b1-84ec-ccd1cbe9d507', '3ddf2d61-a533-570a-9824-d8caae250af0', '0b053108-709d-5a35-9171-28a7541d3a4b', 'd6a5a3dd-7f38-5627-8b30-e270a5a5fb96', 100, 100, 'g'),
  ('19bb4042-dc42-5632-b65c-d86e2f267c42', '3ddf2d61-a533-570a-9824-d8caae250af0', '0b053108-709d-5a35-9171-28a7541d3a4b', '3581cf9f-a44e-5ded-8d50-3b185deda15a', 120, 2, 'piece'),
  ('1cf104e6-eea6-566d-a2b2-91bd6e9c2c45', '3ddf2d61-a533-570a-9824-d8caae250af0', '0b053108-709d-5a35-9171-28a7541d3a4b', '9c1838fa-5ef3-58a4-a683-306cdcacc40e', 80, 80, 'g'),
  ('f89dc1c3-721c-5977-ba8f-3720230e1580', '3ddf2d61-a533-570a-9824-d8caae250af0', '0b053108-709d-5a35-9171-28a7541d3a4b', '5403b232-3d62-53ce-9515-d13982e70155', 300, 300, 'g'),
  ('e842752f-e377-5dbc-8f36-242dd33493c2', '3ddf2d61-a533-570a-9824-d8caae250af0', '0b053108-709d-5a35-9171-28a7541d3a4b', 'e442767c-f4f1-52c8-bab4-ce00d2ad0565', 10, 10, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('20b35f87-bf41-539d-9361-2f041979fd3a', '0b053108-709d-5a35-9171-28a7541d3a4b', 0, 'Butter und Zucker schaumig rühren, Eier unterrühren.'),
  ('e39d35c2-96a6-5af6-83e7-82d92a6f5a9a', '0b053108-709d-5a35-9171-28a7541d3a4b', 1, 'Bananen zerdrücken und untermischen.'),
  ('92c72670-91bb-5db5-a8c6-2ff64aad307e', '0b053108-709d-5a35-9171-28a7541d3a4b', 2, 'Mehl und Backpulver dazusieben und zu einem Teig verrühren.'),
  ('afdcdca6-63dc-5cba-b0da-e8067bae5732', '0b053108-709d-5a35-9171-28a7541d3a4b', 3, 'In einer Kastenform bei 175°C ca. 45 Minuten backen.')
on conflict (id) do nothing;

-- Schoko-Pfannkuchen
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', 'Schoko-Pfannkuchen', 20, 'easy', array['dessert','breakfast'], array['vegetarian'], 4, 200)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('f4e500e2-96bd-559d-9cb8-beb0b6035d2a', 'bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('a9417c88-3a55-5252-bd0f-ebe0aa30a98a', 'f4e500e2-96bd-559d-9cb8-beb0b6035d2a', 'bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', '7b419bb0-be87-5005-b0c6-4225c701d31d', 200, 200, 'g'),
  ('17d8a2a4-a099-5e3b-ac2a-473d7bc70261', 'f4e500e2-96bd-559d-9cb8-beb0b6035d2a', 'bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', '822dcf16-0c0a-5e06-b473-e15521ae62ad', 300, 300, 'ml'),
  ('40d21730-d2a8-5d9b-b0b2-d1b8fde4ea4d', 'f4e500e2-96bd-559d-9cb8-beb0b6035d2a', 'bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', '3581cf9f-a44e-5ded-8d50-3b185deda15a', 120, 2, 'piece'),
  ('4c713d5d-e49e-5e5c-9673-14ebf1ce2710', 'f4e500e2-96bd-559d-9cb8-beb0b6035d2a', 'bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', '6b9ef4d8-5da8-51fa-85b7-209e7521f6c3', 20, 20, 'g'),
  ('d47116cf-e8e0-50f2-bf01-343948cf8265', 'f4e500e2-96bd-559d-9cb8-beb0b6035d2a', 'bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', 'd6a5a3dd-7f38-5627-8b30-e270a5a5fb96', 30, 30, 'g'),
  ('5cae624d-ebcb-532a-84d5-3939e3b53ba0', 'f4e500e2-96bd-559d-9cb8-beb0b6035d2a', 'bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', '9c1838fa-5ef3-58a4-a683-306cdcacc40e', 20, 20, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('7a3a113f-b10a-5dd3-a506-ee979149e2bd', 'bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', 0, 'Mehl, Milch, Eier, Kakaopulver und Zucker zu einem glatten Teig verrühren.'),
  ('dd4727a7-32b2-5480-86f8-09996abf92d4', 'bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', 1, 'Butter in einer Pfanne erhitzen.'),
  ('feb72c9c-b8e9-5430-bf1e-a9303f799e6c', 'bcae14e1-2c3a-54b7-9b2c-3fcf92a05d3e', 2, 'Pfannkuchen von beiden Seiten goldbraun backen.')
on conflict (id) do nothing;

-- Apfel-Crumble
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('99fc2ade-065a-5b99-bee4-b5a07e7686b1', 'Apfel-Crumble', 40, 'medium', array['dessert'], array['vegetarian'], 4, 210)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('6c640854-939b-50d4-b845-ef3fd8cffbc1', '99fc2ade-065a-5b99-bee4-b5a07e7686b1', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('0acf4a3a-3f46-5122-a33d-f516c432b60b', '6c640854-939b-50d4-b845-ef3fd8cffbc1', '99fc2ade-065a-5b99-bee4-b5a07e7686b1', 'd8fa049a-69b6-5519-bad9-5df38dbb11f0', 400, 400, 'g'),
  ('7c62f26f-9465-56db-9405-c63a1c143f03', '6c640854-939b-50d4-b845-ef3fd8cffbc1', '99fc2ade-065a-5b99-bee4-b5a07e7686b1', '3552bd53-8e7d-59a2-9f35-97600b9e858d', 100, 100, 'g'),
  ('b985aa08-09e1-5145-a2b6-e40d614fd3a8', '6c640854-939b-50d4-b845-ef3fd8cffbc1', '99fc2ade-065a-5b99-bee4-b5a07e7686b1', '7b419bb0-be87-5005-b0c6-4225c701d31d', 100, 100, 'g'),
  ('a356a2af-4f8f-5d04-9786-64de50ebb5b4', '6c640854-939b-50d4-b845-ef3fd8cffbc1', '99fc2ade-065a-5b99-bee4-b5a07e7686b1', '9c1838fa-5ef3-58a4-a683-306cdcacc40e', 80, 80, 'g'),
  ('a4309d88-08b7-5237-aded-d0c5c8765a9d', '6c640854-939b-50d4-b845-ef3fd8cffbc1', '99fc2ade-065a-5b99-bee4-b5a07e7686b1', 'd6a5a3dd-7f38-5627-8b30-e270a5a5fb96', 60, 60, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('7c256c92-0a30-524b-a53b-ebf702edfd17', '99fc2ade-065a-5b99-bee4-b5a07e7686b1', 0, 'Äpfel schälen, entkernen und würfeln, in eine Auflaufform geben.'),
  ('69e8b35b-4599-5751-aa57-a5ad234e13bf', '99fc2ade-065a-5b99-bee4-b5a07e7686b1', 1, 'Mehl, Haferflocken, Zucker und Butter zu Streuseln verkneten.'),
  ('a1e63625-dc17-5bb2-b9bc-d95c0261715c', '99fc2ade-065a-5b99-bee4-b5a07e7686b1', 2, 'Streusel über die Äpfel verteilen.'),
  ('a7cf984c-2df8-5a40-ada0-af84008ec04a', '99fc2ade-065a-5b99-bee4-b5a07e7686b1', 3, 'Bei 180°C ca. 30 Minuten backen.')
on conflict (id) do nothing;

-- Schokoladenkuchen
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', 'Schokoladenkuchen', 50, 'medium', array['dessert'], array['vegetarian'], 8, 220)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('70ed1d36-7c04-5f6b-9e15-f74e00184c15', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('17f10453-ca84-59d4-8980-d057e835be9c', '70ed1d36-7c04-5f6b-9e15-f74e00184c15', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', '7b419bb0-be87-5005-b0c6-4225c701d31d', 250, 250, 'g'),
  ('785b8da6-800f-5769-be36-00f1262e0041', '70ed1d36-7c04-5f6b-9e15-f74e00184c15', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', 'd6a5a3dd-7f38-5627-8b30-e270a5a5fb96', 180, 180, 'g'),
  ('e2551529-5e58-5946-8951-0a7b37c3f7cb', '70ed1d36-7c04-5f6b-9e15-f74e00184c15', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', '3581cf9f-a44e-5ded-8d50-3b185deda15a', 180, 3, 'piece'),
  ('7ce17b11-2acd-5967-b6fb-cb88ca653ae4', '70ed1d36-7c04-5f6b-9e15-f74e00184c15', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', '9c1838fa-5ef3-58a4-a683-306cdcacc40e', 150, 150, 'g'),
  ('49b32235-ca1c-5342-94b4-bd5e1e8422d2', '70ed1d36-7c04-5f6b-9e15-f74e00184c15', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', '6b9ef4d8-5da8-51fa-85b7-209e7521f6c3', 50, 50, 'g'),
  ('c20c0640-3f08-5969-9de3-66ab132725bf', '70ed1d36-7c04-5f6b-9e15-f74e00184c15', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', 'e442767c-f4f1-52c8-bab4-ce00d2ad0565', 10, 10, 'g'),
  ('77b7418b-1c1b-5183-9613-42634aabeed1', '70ed1d36-7c04-5f6b-9e15-f74e00184c15', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', '822dcf16-0c0a-5e06-b473-e15521ae62ad', 100, 100, 'ml')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('140ecfae-8f12-5721-9ea4-91f00b541242', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', 0, 'Butter und Zucker schaumig schlagen, Eier nach und nach unterrühren.'),
  ('70ca1f0a-ef13-5c73-9f30-97688045646b', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', 1, 'Mehl, Kakaopulver und Backpulver vermischen und unterheben.'),
  ('a8de369e-5089-5199-b9b3-ba75c95f27aa', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', 2, 'Milch unterrühren, bis ein glatter Teig entsteht.'),
  ('15221ab3-7ade-5f0b-9aad-b68bdf69673a', '6d184a8e-ebfe-5d51-ba58-2e7d7c4d5c7d', 3, 'In einer Kuchenform bei 175°C ca. 40 Minuten backen.')
on conflict (id) do nothing;

-- Tomaten-Knoblauch-Dip
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('f35fcc20-0e80-526e-a46c-ca2de27aadef', 'Tomaten-Knoblauch-Dip', 10, 'easy', array['appetizer'], array['vegetarian'], 4, 230)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('6f12ecea-9b08-52aa-a2d6-df8c2103e416', 'f35fcc20-0e80-526e-a46c-ca2de27aadef', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('e0766bf7-208e-5b00-8030-2617276dbcb6', '6f12ecea-9b08-52aa-a2d6-df8c2103e416', 'f35fcc20-0e80-526e-a46c-ca2de27aadef', '9769015e-92ed-54c9-bc23-f6a5677e8338', 240, 240, 'g'),
  ('84d49a64-f423-5338-9e8c-93a5a7747d15', '6f12ecea-9b08-52aa-a2d6-df8c2103e416', 'f35fcc20-0e80-526e-a46c-ca2de27aadef', '2d5e8b74-f732-5ebb-bb29-87ad85bae5ea', 10, 10, 'g'),
  ('e163c329-3b01-5984-81c4-bc44a889d038', '6f12ecea-9b08-52aa-a2d6-df8c2103e416', 'f35fcc20-0e80-526e-a46c-ca2de27aadef', 'ba00e36d-2a23-5607-b809-9b6f72d14e9d', 20, 20, 'g'),
  ('1197fa55-1fb5-50f0-9bee-0bd5dc4d6499', '6f12ecea-9b08-52aa-a2d6-df8c2103e416', 'f35fcc20-0e80-526e-a46c-ca2de27aadef', '2a1683a5-a292-5e88-b373-cf8d39b846be', 2, 2, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('49a7a1a9-49f3-50ba-b675-e3211cafeeaf', 'f35fcc20-0e80-526e-a46c-ca2de27aadef', 0, 'Knoblauch fein hacken.'),
  ('270c5a06-27a6-5e54-b018-5e1bc8013f12', 'f35fcc20-0e80-526e-a46c-ca2de27aadef', 1, 'Gehackte Tomaten mit Knoblauch und Olivenöl in einem Topf 10 Minuten einkochen.'),
  ('5347a204-a2e9-59d5-b789-61e7f151589a', 'f35fcc20-0e80-526e-a46c-ca2de27aadef', 2, 'Mit Salz abschmecken und abkühlen lassen.')
on conflict (id) do nothing;

-- Brunch-Eierspeise mit Gouda und Paprika
insert into public.recipe_templates
  (id, title, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order)
values
  ('73aa9a5c-0174-55bc-9b1f-a731a1357ce2', 'Brunch-Eierspeise mit Gouda und Paprika', 15, 'easy', array['brunch'], array['vegetarian'], 2, 240)
on conflict (id) do nothing;

insert into public.recipe_template_components (id, template_id, name)
values ('accfe692-1013-55af-a788-b27be2fd8f24', '73aa9a5c-0174-55bc-9b1f-a731a1357ce2', 'Zutaten')
on conflict (id) do nothing;

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams, quantity, unit)
values
  ('c544914c-d7a0-519c-9eb3-6bffd4353269', 'accfe692-1013-55af-a788-b27be2fd8f24', '73aa9a5c-0174-55bc-9b1f-a731a1357ce2', '3581cf9f-a44e-5ded-8d50-3b185deda15a', 180, 3, 'piece'),
  ('8e7bf35c-435b-51a6-af4e-60b9f62753c7', 'accfe692-1013-55af-a788-b27be2fd8f24', '73aa9a5c-0174-55bc-9b1f-a731a1357ce2', '495964f4-f59c-54d5-a6a7-96f3108e0763', 40, 40, 'g'),
  ('71ed22ab-715d-5710-b5ec-c8c98b6a5d85', 'accfe692-1013-55af-a788-b27be2fd8f24', '73aa9a5c-0174-55bc-9b1f-a731a1357ce2', 'd1d42080-0a0d-5388-90cf-49d775108306', 80, 80, 'g'),
  ('d215e994-8166-57cf-8655-f8c163f3e899', 'accfe692-1013-55af-a788-b27be2fd8f24', '73aa9a5c-0174-55bc-9b1f-a731a1357ce2', '9c1838fa-5ef3-58a4-a683-306cdcacc40e', 15, 15, 'g'),
  ('ee3eb008-fe2c-5a2e-8172-c2bfb53a2c17', 'accfe692-1013-55af-a788-b27be2fd8f24', '73aa9a5c-0174-55bc-9b1f-a731a1357ce2', '2a1683a5-a292-5e88-b373-cf8d39b846be', 1, 1, 'g')
on conflict (id) do nothing;

insert into public.recipe_template_steps (id, template_id, position, text)
values
  ('f9db0af5-4c63-553d-a24c-42e5d47faa6f', '73aa9a5c-0174-55bc-9b1f-a731a1357ce2', 0, 'Paprika fein würfeln.'),
  ('3f743705-ffe6-5b41-a4d6-33f0d502e09a', '73aa9a5c-0174-55bc-9b1f-a731a1357ce2', 1, 'Eier verquirlen, Paprika unterrühren.'),
  ('9f750408-1552-5a5b-8763-33f35c15dc16', '73aa9a5c-0174-55bc-9b1f-a731a1357ce2', 2, 'Butter in einer Pfanne erhitzen, Eiermasse hineingeben.'),
  ('00ed3d3a-16e6-5eb2-b1b2-71722a109fda', '73aa9a5c-0174-55bc-9b1f-a731a1357ce2', 3, 'Gouda reiben, kurz vor Ende unterrühren und stocken lassen.')
on conflict (id) do nothing;

