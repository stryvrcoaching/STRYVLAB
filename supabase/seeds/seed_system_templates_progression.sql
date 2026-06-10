-- ============================================================
-- SEED — Double Progression sur les 5 archétypes système
--
-- Applique rep_min, rep_max, target_rir, weight_increment_kg
-- sur chaque exercice des templates système.
--
-- Idempotent : UPDATE par UUID fixe.
-- Prérequis : seed_system_templates.sql + migration 20260405_double_progression.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Règles appliquées par archétype
--
-- Archétype 1 — Fondation (beginner)
--   Composés : 10-12 reps, RIR 3, +2.5kg
--   Isolation : 12-15 reps, RIR 3, +2.5kg
--   Isométrique/durée : NULL (pas de DP)
--
-- Archétype 2 — PPL Hypertrophie (intermediate)
--   Composés principaux : 6-10 reps, RIR 2, +2.5kg
--   Composés secondaires : 8-12 reps, RIR 2, +2.5kg
--   Isolation : 10-15 reps, RIR 2, +2.5kg
--
-- Archétype 3 — Force (advanced)
--   Principaux : 3-5 reps, RIR 1, +5kg
--   Assistance : 6-8 reps, RIR 2, +2.5kg
--   Isométrique : NULL
--
-- Archétype 4 — Recomposition (intermédiaire, circuits)
--   Tous : RIR 3, +2.5kg, plages conservées depuis reps
--
-- Archétype 5 — Chaîne postérieure (intermediate)
--   Principaux : 8-12 reps, RIR 2, +2.5kg
--   Isolation haute rep : 12-15 reps, RIR 2, +2.5kg
--   Finisher : 15-20 reps, RIR 4, +2.5kg
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- ARCHÉTYPE 1 — Fondation Full-Body
-- ============================================================

-- Jour A
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000001'; -- Squat Goblet
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000002'; -- Développé Haltères Couché
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000003'; -- Rowing Haltère Unilatéral
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000004'; -- Développé Militaire Haltères
-- Planche isométrique : pas de DP (reps=durée)

-- Jour B
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000011'; -- SDT Roumain Haltères
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000012'; -- Hip Thrust PDC (progression reps)
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000013'; -- Tirage Vertical Machine
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000014'; -- Développé Incliné Haltères
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000015'; -- Oiseau Face au Sol

-- Jour A bis (même config que Jour A)
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000021';
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000022';
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000023';
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a1000000-0000-0000-0002-000000000024';

-- ============================================================
-- ARCHÉTYPE 2 — PPL Hypertrophie Intermédiaire
-- ============================================================

-- Push A
update public.coach_program_template_exercises set rep_min=6,  rep_max=10, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000001'; -- Développé Couché Barre (composé principal)
update public.coach_program_template_exercises set rep_min=8,  rep_max=12, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000002'; -- Développé Incliné Haltères
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000003'; -- Élévation Latérale
update public.coach_program_template_exercises set rep_min=10, rep_max=15, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000004'; -- Extension Triceps Poulie
update public.coach_program_template_exercises set rep_min=10, rep_max=15, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000005'; -- Dips Triceps

-- Pull A
update public.coach_program_template_exercises set rep_min=6,  rep_max=10, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000011'; -- Tirage Vertical (composé principal)
update public.coach_program_template_exercises set rep_min=8,  rep_max=12, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000012'; -- Rowing Câble
update public.coach_program_template_exercises set rep_min=8,  rep_max=12, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000013'; -- Rowing Haltère Unilatéral
update public.coach_program_template_exercises set rep_min=15, rep_max=20, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000014'; -- Face Pull
update public.coach_program_template_exercises set rep_min=8,  rep_max=12, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000015'; -- Curl Barre EZ
update public.coach_program_template_exercises set rep_min=10, rep_max=15, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000016'; -- Curl Marteau

-- Legs
update public.coach_program_template_exercises set rep_min=6,  rep_max=10, target_rir=2, weight_increment_kg=5.0 where id='a2000000-0000-0000-0002-000000000021'; -- Squat Barre (5kg pour les gros muscles)
update public.coach_program_template_exercises set rep_min=10, rep_max=15, target_rir=2, weight_increment_kg=5.0 where id='a2000000-0000-0000-0002-000000000022'; -- Leg Press
update public.coach_program_template_exercises set rep_min=8,  rep_max=12, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000023'; -- SDT Roumain Barre
update public.coach_program_template_exercises set rep_min=10, rep_max=15, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000024'; -- Leg Curl
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000025'; -- Leg Extension
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000026'; -- Mollets
-- Crunch câble : 12-15 reps
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000027';

-- Push B
update public.coach_program_template_exercises set rep_min=6,  rep_max=10, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000031'; -- Développé Militaire Barre
update public.coach_program_template_exercises set rep_min=8,  rep_max=12, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000032'; -- Développé Couché Haltères
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000033'; -- Élévation Latérale Câble
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000034'; -- Élévation Frontale
update public.coach_program_template_exercises set rep_min=10, rep_max=15, target_rir=2, weight_increment_kg=2.5 where id='a2000000-0000-0000-0002-000000000035'; -- Extension Triceps au-dessus tête

-- ============================================================
-- ARCHÉTYPE 3 — Force Maximale Upper/Lower
-- ============================================================

-- Upper A
update public.coach_program_template_exercises set rep_min=3, rep_max=5, target_rir=1, weight_increment_kg=5.0 where id='a3000000-0000-0000-0002-000000000001'; -- Développé Couché Barre (force)
update public.coach_program_template_exercises set rep_min=4, rep_max=6, target_rir=1, weight_increment_kg=5.0 where id='a3000000-0000-0000-0002-000000000002'; -- Tirage Horizontal Barre
update public.coach_program_template_exercises set rep_min=5, rep_max=6, target_rir=1, weight_increment_kg=2.5 where id='a3000000-0000-0000-0002-000000000003'; -- Développé Incliné Barre
update public.coach_program_template_exercises set rep_min=6, rep_max=8, target_rir=1, weight_increment_kg=2.5 where id='a3000000-0000-0000-0002-000000000004'; -- Dips Lestés
update public.coach_program_template_exercises set rep_min=6, rep_max=8, target_rir=2, weight_increment_kg=2.5 where id='a3000000-0000-0000-0002-000000000005'; -- Curl Biceps Barre

-- Lower A
update public.coach_program_template_exercises set rep_min=3, rep_max=5, target_rir=1, weight_increment_kg=5.0 where id='a3000000-0000-0000-0002-000000000011'; -- Squat Barre (force)
update public.coach_program_template_exercises set rep_min=3, rep_max=4, target_rir=2, weight_increment_kg=5.0 where id='a3000000-0000-0000-0002-000000000012'; -- Squat Pause
update public.coach_program_template_exercises set rep_min=8, rep_max=10, target_rir=2, weight_increment_kg=5.0 where id='a3000000-0000-0000-0002-000000000013'; -- Leg Press Pieds Hauts
-- Planche lestée : pas de DP (durée)

-- Upper B
update public.coach_program_template_exercises set rep_min=3, rep_max=5, target_rir=1, weight_increment_kg=2.5 where id='a3000000-0000-0000-0002-000000000021'; -- Développé Militaire Barre
update public.coach_program_template_exercises set rep_min=4, rep_max=6, target_rir=1, weight_increment_kg=2.5 where id='a3000000-0000-0000-0002-000000000022'; -- Traction Lestée
update public.coach_program_template_exercises set rep_min=4, rep_max=6, target_rir=1, weight_increment_kg=5.0 where id='a3000000-0000-0000-0002-000000000023'; -- Rowing Barbell Penché
update public.coach_program_template_exercises set rep_min=6, rep_max=8, target_rir=2, weight_increment_kg=2.5 where id='a3000000-0000-0000-0002-000000000024'; -- Skullcrusher
update public.coach_program_template_exercises set rep_min=6, rep_max=8, target_rir=2, weight_increment_kg=2.5 where id='a3000000-0000-0000-0002-000000000025'; -- Curl Incliné Haltères

-- Lower B
update public.coach_program_template_exercises set rep_min=3, rep_max=5, target_rir=1, weight_increment_kg=5.0 where id='a3000000-0000-0000-0002-000000000031'; -- SDT Conventionnel
update public.coach_program_template_exercises set rep_min=5, rep_max=6, target_rir=2, weight_increment_kg=5.0 where id='a3000000-0000-0000-0002-000000000032'; -- SDT Roumain
update public.coach_program_template_exercises set rep_min=6, rep_max=8, target_rir=2, weight_increment_kg=2.5 where id='a3000000-0000-0000-0002-000000000033'; -- Fente Marchée
update public.coach_program_template_exercises set rep_min=6, rep_max=8, target_rir=2, weight_increment_kg=5.0 where id='a3000000-0000-0000-0002-000000000034'; -- Hip Thrust Barre Lourd
-- Pallof Press : pas de DP (reps/côté anti-rotation)

-- ============================================================
-- ARCHÉTYPE 4 — Recomposition Densité & Circuits
-- ============================================================

-- Séance A
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000001'; -- Développé Couché Haltères
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000002'; -- Rowing Câble
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000003'; -- Hip Thrust Haltère
update public.coach_program_template_exercises set rep_min=10, rep_max=10, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000004'; -- Fente Avant (reps fixes par jambe)
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000005'; -- Développé Militaire Haltères
-- Mountain Climbers : pas de DP (cardio)

-- Séance B
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000011'; -- Squat Goblet
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000012'; -- Tirage Vertical Poulie
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000013'; -- SDT Roumain Haltères
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000014'; -- Développé Militaire Assis
-- Burpee : pas de DP (cardio)

-- Séance C (circuit)
update public.coach_program_template_exercises set rep_min=15, rep_max=15, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000021'; -- Squat Haltères circuit
update public.coach_program_template_exercises set rep_min=12, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000022'; -- Rowing circuit
update public.coach_program_template_exercises set rep_min=12, rep_max=12, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000023'; -- Arnold Press circuit
update public.coach_program_template_exercises set rep_min=15, rep_max=15, target_rir=3, weight_increment_kg=2.5 where id='a4000000-0000-0000-0002-000000000024'; -- Glute Bridge circuit

-- ============================================================
-- ARCHÉTYPE 5 — Spécialisation Chaîne Postérieure
-- ============================================================

-- Jour A
update public.coach_program_template_exercises set rep_min=8,  rep_max=12, target_rir=2, weight_increment_kg=5.0  where id='a5000000-0000-0000-0002-000000000001'; -- Hip Thrust Barre
update public.coach_program_template_exercises set rep_min=8,  rep_max=12, target_rir=2, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000002'; -- SDT Roumain Barre
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=2, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000003'; -- Fente Bulgare
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=3, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000004'; -- Good Morning
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000005'; -- Rowing Barre (maintenance)

-- Jour B
update public.coach_program_template_exercises set rep_min=6,  rep_max=10, target_rir=2, weight_increment_kg=5.0  where id='a5000000-0000-0000-0002-000000000011'; -- SDT Sumo
update public.coach_program_template_exercises set rep_min=10, rep_max=15, target_rir=2, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000012'; -- Leg Curl Couché
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=2, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000013'; -- Hip Thrust Unilatéral
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=2, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000014'; -- Hyperextension 45°
update public.coach_program_template_exercises set rep_min=12, rep_max=15, target_rir=2, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000015'; -- Mollets Assis

-- Jour C
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000021'; -- Tirage Vertical (maintenance)
update public.coach_program_template_exercises set rep_min=10, rep_max=12, target_rir=3, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000022'; -- Développé Couché (maintenance)
update public.coach_program_template_exercises set rep_min=15, rep_max=20, target_rir=3, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000023'; -- Face Pull (maintenance)
update public.coach_program_template_exercises set rep_min=6,  rep_max=8,  target_rir=2, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000024'; -- Nordic Curl
update public.coach_program_template_exercises set rep_min=15, rep_max=20, target_rir=4, weight_increment_kg=2.5  where id='a5000000-0000-0000-0002-000000000025'; -- SDT Roumain Finisher

-- ============================================================
-- Vérification post-seed
-- select name, rep_min, rep_max, target_rir, weight_increment_kg
-- from public.coach_program_template_exercises
-- where rep_min is not null
-- order by created_at;
-- ============================================================
