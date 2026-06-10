-- ============================================================
-- SEED — image_url + correction muscle_tags pour les 5 archétypes système
-- Générés automatiquement via matching catalog JSON × movement_pattern
-- Exécuter via Supabase SQL Editor (service role)
-- Idempotent : UPDATE WHERE — safe à rejouer
-- ============================================================

-- ── Correction muscle_tags (aligner avec MUSCLE_OPTIONS du builder) ──────────
update public.coach_program_templates
  set muscle_tags = ARRAY['Full Body', 'Fessiers', 'Dos', 'Pectoraux', 'Posture']
  where id = 'a1000000-0000-0000-0000-000000000001';

update public.coach_program_templates
  set muscle_tags = ARRAY['Pectoraux', 'Épaules', 'Triceps', 'Dos', 'Biceps', 'Jambes', 'Fessiers', 'Ischio-jambiers']
  where id = 'a2000000-0000-0000-0000-000000000002';

update public.coach_program_templates
  set muscle_tags = ARRAY['Full Body', 'Pectoraux', 'Dos', 'Jambes', 'Fessiers', 'Épaules', 'Triceps', 'Biceps']
  where id = 'a3000000-0000-0000-0000-000000000003';

update public.coach_program_templates
  set muscle_tags = ARRAY['Full Body', 'Pectoraux', 'Dos', 'Fessiers', 'Épaules', 'Abdos']
  where id = 'a4000000-0000-0000-0000-000000000004';

update public.coach_program_templates
  set muscle_tags = ARRAY['Fessiers', 'Ischio-jambiers', 'Lombaires', 'Dos', 'Mollets']
  where id = 'a5000000-0000-0000-0000-000000000005';

-- ── ARCHÉTYPE 1 — Initiation Full-Body ──────────────────────────────────────
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/squat-goblet-exercice-musculation.gif' where id = 'a1000000-0000-0000-0002-000000000001'; -- Squat Goblet
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/pectoraux/developpe-couche-halteres-exercice-musculation.gif' where id = 'a1000000-0000-0000-0002-000000000002'; -- Développé Haltères Couché
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/rowing-haltere-un-bras.gif' where id = 'a1000000-0000-0000-0002-000000000003'; -- Rowing Haltère Unilatéral
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/developpe-epaule-halteres.gif' where id = 'a1000000-0000-0000-0002-000000000004'; -- Développé Militaire Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/abdos/planche-abdos.gif' where id = 'a1000000-0000-0000-0002-000000000005'; -- Planche Isométrique

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/souleve-de-terre-sumo-haltere.gif' where id = 'a1000000-0000-0000-0002-000000000011'; -- Soulevé de Terre Roumain Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/hip-thrust-barre-unilateral.gif' where id = 'a1000000-0000-0000-0002-000000000012'; -- Hip Thrust au Poids du Corps
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/tirage-incline-poulie-haute.gif' where id = 'a1000000-0000-0000-0002-000000000013'; -- Tirage Vertical Machine / Poulie Haute
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/pectoraux/developpe-incline-halteres-exercice-musculation.gif' where id = 'a1000000-0000-0000-0002-000000000014'; -- Développé Incliné Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/croix-de-fer-halteres.gif' where id = 'a1000000-0000-0000-0002-000000000015'; -- Oiseau Face au Sol (Reverse Fly) Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/abdos/dead-bug.gif' where id = 'a1000000-0000-0000-0002-000000000016'; -- Dead Bug

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/squat-goblet-exercice-musculation.gif' where id = 'a1000000-0000-0000-0002-000000000021'; -- Squat Goblet (Jour A bis)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/pectoraux/developpe-couche-halteres-exercice-musculation.gif' where id = 'a1000000-0000-0000-0002-000000000022'; -- Développé Haltères Couché (Jour A bis)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/rowing-haltere-un-bras.gif' where id = 'a1000000-0000-0000-0002-000000000023'; -- Rowing Haltère Unilatéral (Jour A bis)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/developpe-epaule-halteres.gif' where id = 'a1000000-0000-0000-0002-000000000024'; -- Développé Militaire Haltères (Jour A bis)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/abdos/planche-abdos.gif' where id = 'a1000000-0000-0000-0002-000000000025'; -- Planche Isométrique (Jour A bis)

-- ── ARCHÉTYPE 2 — Hypertrophie Intermédiaire PPL ─────────────────────────────
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/pectoraux/developpe-couche.gif' where id = 'a2000000-0000-0000-0002-000000000001'; -- Développé Couché Barre
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/pectoraux/developpe-incline-halteres-exercice-musculation.gif' where id = 'a2000000-0000-0000-0002-000000000002'; -- Développé Incliné Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/croix-de-fer-halteres.gif' where id = 'a2000000-0000-0000-0002-000000000003'; -- Élévation Latérale Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/triceps/extension-triceps-poulie-haute-corde.gif' where id = 'a2000000-0000-0000-0002-000000000004'; -- Extension Triceps Poulie Haute (Corde)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/triceps/extension-triceps-machine-technogym.gif' where id = 'a2000000-0000-0000-0002-000000000005'; -- Dips Triceps (machine ou parallèles)

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/tirage-vertical-prise-inversee.gif' where id = 'a2000000-0000-0000-0002-000000000011'; -- Tirage Vertical Prise Large (Lat Pulldown)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/rowing-horizontal-bande-elastique-exercice-dos.gif' where id = 'a2000000-0000-0000-0002-000000000012'; -- Rowing Câble Horizontal
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/rowing-haltere-un-bras.gif' where id = 'a2000000-0000-0000-0002-000000000013'; -- Rowing Haltère Unilatéral
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/elevation-frontale-poulie-basse.gif' where id = 'a2000000-0000-0000-0002-000000000014'; -- Face Pull Poulie Haute (Corde)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/biceps/curl-au-pupitre-barre-ez-larry-scott.gif' where id = 'a2000000-0000-0000-0002-000000000015'; -- Curl Biceps Barre EZ
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/biceps/curl-haltere-prise-marteau-pupitre.gif' where id = 'a2000000-0000-0000-0002-000000000016'; -- Curl Marteau Haltères

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/homme-faisant-un-squat-avec-barre.gif' where id = 'a2000000-0000-0000-0002-000000000021'; -- Squat Barre Haut
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/leg-press-sur-le-cote.gif' where id = 'a2000000-0000-0000-0002-000000000022'; -- Leg Press 45°
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/souleve-de-terre-roumain-kettlebell.gif' where id = 'a2000000-0000-0000-0002-000000000023'; -- Soulevé de Terre Roumain Barre
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/ischio-jambiers/leg-curl-assis-machine.gif' where id = 'a2000000-0000-0000-0002-000000000024'; -- Leg Curl Couché Machine
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/quadriceps/leg-extension-exercice-musculation.gif' where id = 'a2000000-0000-0000-0002-000000000025'; -- Leg Extension Machine
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/mollets/extension-mollets-barre-debout.gif' where id = 'a2000000-0000-0000-0002-000000000026'; -- Mollets Debout Machine / Barre
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/abdos/crunch-a-la-poulie-pour-les-obliques.gif' where id = 'a2000000-0000-0000-0002-000000000027'; -- Crunch Câble

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/developpe-militaire-exercice-musculation.gif' where id = 'a2000000-0000-0000-0002-000000000031'; -- Développé Militaire Barre Debout
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/pectoraux/developpe-couche-halteres-exercice-musculation.gif' where id = 'a2000000-0000-0000-0002-000000000032'; -- Développé Couché Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/elevation-frontale-allongee-a-la-barre.gif' where id = 'a2000000-0000-0000-0002-000000000033'; -- Élévation Latérale Câble Unilatéral
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/developpe-epaule-halteres.gif' where id = 'a2000000-0000-0000-0002-000000000034'; -- Élévation Frontale Haltères Alternée
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/triceps/extension-triceps-derriere-tete-avec-elastique.gif' where id = 'a2000000-0000-0000-0002-000000000035'; -- Extension Triceps Barre EZ au-dessus de la Tête

-- ── ARCHÉTYPE 3 — Force Maximale Upper/Lower ─────────────────────────────────
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/pectoraux/developpe-couche.gif' where id = 'a3000000-0000-0000-0002-000000000001'; -- Développé Couché Barre
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/rowing-buste-penche-avec-elastique.gif' where id = 'a3000000-0000-0000-0002-000000000002'; -- Tirage Horizontal Barre (Barbell Row)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/pectoraux/developpe-incline-barre.gif' where id = 'a3000000-0000-0000-0002-000000000003'; -- Développé Incliné Barre
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/triceps/extensions-triceps-planche.gif' where id = 'a3000000-0000-0000-0002-000000000004'; -- Dips Lestés
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/biceps/curl-au-pupitre-barre-ez-larry-scott.gif' where id = 'a3000000-0000-0000-0002-000000000005'; -- Curl Biceps Barre Droite

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/homme-faisant-un-squat-avec-barre.gif' where id = 'a3000000-0000-0000-0002-000000000011'; -- Squat Barre Haut
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/homme-faisant-un-squat-avec-barre.gif' where id = 'a3000000-0000-0000-0002-000000000012'; -- Squat Pause
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/leg-press-sur-le-cote.gif' where id = 'a3000000-0000-0000-0002-000000000013'; -- Leg Press 45° Pieds Hauts
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/abdos/planche-abdos.gif' where id = 'a3000000-0000-0000-0002-000000000014'; -- Gainage Planche Lestée

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/developpe-militaire-exercice-musculation.gif' where id = 'a3000000-0000-0000-0002-000000000021'; -- Développé Militaire Barre Debout
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/traction-prise-neutre.gif' where id = 'a3000000-0000-0000-0002-000000000022'; -- Traction Lestée Prise Large
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/rowing-buste-penche-avec-elastique.gif' where id = 'a3000000-0000-0000-0002-000000000023'; -- Rowing Barbell Penché
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/triceps/barre-front.gif' where id = 'a3000000-0000-0000-0002-000000000024'; -- Extension Triceps Couché Barre EZ (Skullcrusher)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/biceps/curl-haltere-debout-banc-incline.gif' where id = 'a3000000-0000-0000-0002-000000000025'; -- Curl Incliné Haltères

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/souleve-de-terre-avec-machine.gif' where id = 'a3000000-0000-0000-0002-000000000031'; -- Soulevé de Terre Conventionnel
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/souleve-de-terre-roumain-kettlebell.gif' where id = 'a3000000-0000-0000-0002-000000000032'; -- Soulevé de Terre Roumain Barre
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/fente-avant-barre-femme.gif' where id = 'a3000000-0000-0000-0002-000000000033'; -- Fente Marchée Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/hip-thrust-barre-unilateral.gif' where id = 'a3000000-0000-0000-0002-000000000034'; -- Hip Thrust Barre Lourde
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/abdos/gainage-ours-bear-plank.gif' where id = 'a3000000-0000-0000-0002-000000000035'; -- Gainage Pallof Press

-- ── ARCHÉTYPE 4 — Recomposition / Densité & Circuits ─────────────────────────
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/pectoraux/developpe-couche-halteres-exercice-musculation.gif' where id = 'a4000000-0000-0000-0002-000000000001'; -- A1 — Développé Couché Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/rowing-horizontal-bande-elastique-exercice-dos.gif' where id = 'a4000000-0000-0000-0002-000000000002'; -- A2 — Rowing Câble Horizontal
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/souleve-de-terre-sumo-haltere.gif' where id = 'a4000000-0000-0000-0002-000000000003'; -- B1 — Hip Thrust Haltère
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/fente-avant-barre-femme.gif' where id = 'a4000000-0000-0000-0002-000000000004'; -- B2 — Fente Avant Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/developpe-epaule-halteres.gif' where id = 'a4000000-0000-0000-0002-000000000005'; -- C1 — Développé Militaire Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/abdos/mountain-climber-exercice-musculation.gif' where id = 'a4000000-0000-0000-0002-000000000006'; -- C2 — Planche Dynamique (Mountain Climbers)

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/squat-goblet-exercice-musculation.gif' where id = 'a4000000-0000-0000-0002-000000000011'; -- A1 — Squat Goblet
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/tirage-incline-poulie-haute.gif' where id = 'a4000000-0000-0000-0002-000000000012'; -- A2 — Tirage Vertical Poulie
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/souleve-de-terre-roumain-kettlebell.gif' where id = 'a4000000-0000-0000-0002-000000000013'; -- B1 — Soulevé de Terre Roumain Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/developpe-epaule-halteres.gif' where id = 'a4000000-0000-0000-0002-000000000014'; -- B2 — Développé Militaire Haltères Assis
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/abdos/planche-abdos.gif' where id = 'a4000000-0000-0000-0002-000000000015'; -- C — Burpee Simplifié

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/front-squat-avec-halteres.gif' where id = 'a4000000-0000-0000-0002-000000000021'; -- Squat Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/rowing-haltere-un-bras.gif' where id = 'a4000000-0000-0000-0002-000000000022'; -- Rowing Haltère Debout (Tronc Penché)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/developpe-arnold-exercice-musculation.gif' where id = 'a4000000-0000-0000-0002-000000000023'; -- Développé Haltères Debout (Arnold Press)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/hip-thrust-a-la-machine.gif' where id = 'a4000000-0000-0000-0002-000000000024'; -- Hip Thrust au Sol (Glute Bridge) Lest

-- ── ARCHÉTYPE 5 — Spécialisation Chaîne Postérieure ─────────────────────────
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/hip-thrust-barre-unilateral.gif' where id = 'a5000000-0000-0000-0002-000000000001'; -- Hip Thrust Barre
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/souleve-de-terre-roumain-kettlebell.gif' where id = 'a5000000-0000-0000-0002-000000000002'; -- Soulevé de Terre Roumain Barre
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/squat-bulgare-halteres-exercice-musculation.gif' where id = 'a5000000-0000-0000-0002-000000000003'; -- Fente Bulgare Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/ischio-jambiers/nordic-hamstring-curl-avec-elastique.gif' where id = 'a5000000-0000-0000-0002-000000000004'; -- Good Morning Barre Légère
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/rowing-barre-t-landmine.gif' where id = 'a5000000-0000-0000-0002-000000000005'; -- Rowing Barre Penché (maintenance dos)

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/souleve-de-terre-sumo-haltere.gif' where id = 'a5000000-0000-0000-0002-000000000011'; -- Soulevé de Terre Sumo
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/ischio-jambiers/leg-curl-assis-machine.gif' where id = 'a5000000-0000-0000-0002-000000000012'; -- Leg Curl Couché Machine
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/hip-thrust-barre-unilateral.gif' where id = 'a5000000-0000-0000-0002-000000000013'; -- Hip Thrust Unilatéral (une jambe)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/reverse-hyperextension.gif' where id = 'a5000000-0000-0000-0002-000000000014'; -- Hyperextension 45° (Back Extension)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/mollets/extension-mollets-assis-machine-smith.gif' where id = 'a5000000-0000-0000-0002-000000000015'; -- Mollets Assis Machine

update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/dos/tirage-incline-poulie-haute.gif' where id = 'a5000000-0000-0000-0002-000000000021'; -- Tirage Vertical Poulie (Lat Pulldown)
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/pectoraux/developpe-couche-halteres-exercice-musculation.gif' where id = 'a5000000-0000-0000-0002-000000000022'; -- Développé Couché Haltères
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/epaules/elevation-frontale-poulie-basse.gif' where id = 'a5000000-0000-0000-0002-000000000023'; -- Face Pull Poulie Haute
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/ischio-jambiers/nordic-hamstring-curl-avec-elastique.gif' where id = 'a5000000-0000-0000-0002-000000000024'; -- Nordic Curl Assisté
update public.coach_program_template_exercises set image_url = '/bibliotheque_exercices/fessiers/souleve-de-terre-sumo-haltere.gif' where id = 'a5000000-0000-0000-0002-000000000025'; -- Soulevé de Terre Roumain Haltères Léger (Finisher)
