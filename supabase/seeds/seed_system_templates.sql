-- ============================================================
-- SEED — 5 Archétypes fondamentaux STRYVR
-- Idempotent : ON CONFLICT (id) DO NOTHING — UUIDs fixes sur toutes les tables
-- Exécuter via Supabase SQL Editor (service role — bypass RLS)
--
-- Ordre d'exécution :
--   1. Templates (coach_program_templates)
--   2. Sessions (coach_program_template_sessions)
--   3. Exercices (coach_program_template_exercises)
--
-- Tous les UUIDs sont fixes pour garantir l'idempotence complète.
-- ============================================================

-- ============================================================
-- ARCHÉTYPE 1 — Initiation Full-Body & Apprentissage Moteur
-- Objectif : maintenance | Niveau : beginner | 3j/sem. | 8 sem.
-- ============================================================

insert into public.coach_program_templates
  (id, coach_id, slug, name, description, goal, level, frequency, weeks,
   muscle_tags, equipment_archetype, is_system, is_public, notes)
values (
  'a1000000-0000-0000-0000-000000000001',
  null,
  'system-full-body-fondation',
  'Initiation Full-Body & Apprentissage Moteur',
  'Programme axé sur l''assimilation des schémas moteurs fondamentaux (Squat, Hinge, Push, Pull) et l''adaptation des tissus conjonctifs. Volume bas, fréquence de répétition des mouvements haute. Alternance Jour A / Jour B sur 3 séances par semaine.',
  'maintenance',
  'beginner',
  3,
  8,
  ARRAY['Full Body', 'Fessiers', 'Dos', 'Pectoraux', 'Posture'],
  'commercial_gym',
  true,
  true,
  'Accent sur les muscles posturaux : rhomboïdes, trapèzes moyens, fessiers, érecteurs du rachis. Repos entre séries : 90–120s. Ne pas progresser en charge avant que la technique soit maîtrisée. Deload à la semaine 8.'
)
on conflict (id) do nothing;

-- Sessions Archétype 1
insert into public.coach_program_template_sessions
  (id, template_id, name, day_of_week, position, notes)
values
  ('a1000000-0000-0000-0001-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Jour A — Full Body (Squat dominant)', 1, 0, 'Focus : squat pattern + push horizontal. Priorité absolue à la position du bassin et de la colonne.'),
  ('a1000000-0000-0000-0001-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Jour B — Full Body (Hinge dominant)', 3, 1, 'Focus : hinge pattern + pull vertical. Gainage actif sur toute la séance. Ne pas arrondir le dos sur les exercices de charnière.'),
  ('a1000000-0000-0000-0001-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Jour A bis — Répétition Jour A', 5, 2, 'Même contenu que Jour A. Semaines impaires = Jour A. Semaines paires = Jour B.')
on conflict (id) do nothing;

-- Exercices Jour A
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a1000000-0000-0000-0002-000000000001', 'a1000000-0000-0000-0001-000000000001',
   'Squat Goblet', 3, '10-12', 90, 3, 'squat_pattern', ARRAY['dumbbell'], 0,
   'Haltère tenu au niveau du sternum. Pieds à largeur d''épaules, orteils légèrement tournés vers l''extérieur. Descente contrôlée 3 secondes. Genou dans l''axe du pied.'),
  ('a1000000-0000-0000-0002-000000000002', 'a1000000-0000-0000-0001-000000000001',
   'Développé Haltères Couché', 3, '10-12', 90, 3, 'horizontal_push', ARRAY['dumbbell', 'bench'], 1,
   'Coudes à 45° du corps. Ne pas verrouiller les coudes en extension. Omoplate rétractées et déprimées pendant tout le mouvement.'),
  ('a1000000-0000-0000-0002-000000000003', 'a1000000-0000-0000-0001-000000000001',
   'Rowing Haltère Unilatéral', 3, '10-12', 90, 3, 'horizontal_pull', ARRAY['dumbbell', 'bench'], 2,
   'Appui sur le banc avec genou et main ipsilatéraux. Tirer le coude vers la hanche, pas vers l''épaule. Contracter le grand dorsal en fin de mouvement.'),
  ('a1000000-0000-0000-0002-000000000004', 'a1000000-0000-0000-0001-000000000001',
   'Développé Militaire Haltères', 2, '10-12', 90, 3, 'vertical_push', ARRAY['dumbbell'], 3,
   'Debout ou assis, dos droit. Ne pas cambrer excessivement. Expiration pendant la poussée. Prise neutre ou pronation selon confort articulaire.'),
  ('a1000000-0000-0000-0002-000000000005', 'a1000000-0000-0000-0001-000000000001',
   'Planche Isométrique', 3, '20-30s', 60, null, 'core_anti_flex', ARRAY[]::text[], 4,
   'Bassin en légère rétroversion. Fessiers contractés. Ne pas laisser les hanches monter ou descendre. Respiration normale pendant l''effort.');

-- Exercices Jour B
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a1000000-0000-0000-0002-000000000011', 'a1000000-0000-0000-0001-000000000002',
   'Soulevé de Terre Roumain Haltères', 3, '10-12', 90, 3, 'hip_hinge', ARRAY['dumbbell'], 0,
   'Hanches arrière en priorité — pas de fléchissement des genoux dominant. Barre (ou haltères) glisse le long des cuisses. Sensation d''étirement des ischio-jambiers en bas. Dos plat.'),
  ('a1000000-0000-0000-0002-000000000012', 'a1000000-0000-0000-0001-000000000002',
   'Hip Thrust au Poids du Corps', 3, '12-15', 75, 3, 'hip_hinge', ARRAY['bench'], 1,
   'Épaules sur le banc, pieds à plat. Extension complète de hanche en haut — pas de cambrure lombaire. Contracter les fessiers 1 seconde en position haute.'),
  ('a1000000-0000-0000-0002-000000000013', 'a1000000-0000-0000-0001-000000000002',
   'Tirage Vertical Machine / Poulie Haute', 3, '10-12', 90, 3, 'vertical_pull', ARRAY['cable_machine'], 1,
   'Prise légèrement plus large que les épaules. Tirer les coudes vers les hanches. Omoplate en rétraction et dépression en fin de mouvement. Ne pas se balancer.'),
  ('a1000000-0000-0000-0002-000000000014', 'a1000000-0000-0000-0001-000000000002',
   'Développé Incliné Haltères', 3, '10-12', 90, 3, 'horizontal_push', ARRAY['dumbbell', 'bench'], 2,
   'Banc à 30°. Même technique que le développé plat. L''inclinaison accentue le recrutement des faisceaux supérieurs des pectoraux et des deltoïdes antérieurs.'),
  ('a1000000-0000-0000-0002-000000000015', 'a1000000-0000-0000-0001-000000000002',
   'Oiseau Face au Sol (Reverse Fly) Haltères', 2, '12-15', 75, 3, 'lateral_raise', ARRAY['dumbbell'], 3,
   'Légèrement penché en avant. Bras légèrement fléchis. Élévation latérale jusqu''à hauteur des épaules. Cible les rhomboïdes, trapèzes moyens et deltoïdes postérieurs — muscles posturaux prioritaires.'),
  ('a1000000-0000-0000-0002-000000000016', 'a1000000-0000-0000-0001-000000000002',
   'Dead Bug', 3, '8/côté', 60, null, 'core_anti_flex', ARRAY[]::text[], 4,
   'Lombaires plaquées au sol pendant toute la durée. Extension alternée bras/jambe controlatéraux. Mouvement lent et contrôlé. Arrêter dès que le bas du dos décolle.');

-- Jour A bis = même exercices que Jour A (référence par nom)
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a1000000-0000-0000-0002-000000000021', 'a1000000-0000-0000-0001-000000000003',
   'Squat Goblet', 3, '10-12', 90, 3, 'squat_pattern', ARRAY['dumbbell'], 0,
   'Cf. Jour A. Semaine paire : appliquer Jour B à la place.'),
  ('a1000000-0000-0000-0002-000000000022', 'a1000000-0000-0000-0001-000000000003',
   'Développé Haltères Couché', 3, '10-12', 90, 3, 'horizontal_push', ARRAY['dumbbell', 'bench'], 1, null),
  ('a1000000-0000-0000-0002-000000000023', 'a1000000-0000-0000-0001-000000000003',
   'Rowing Haltère Unilatéral', 3, '10-12', 90, 3, 'horizontal_pull', ARRAY['dumbbell', 'bench'], 2, null),
  ('a1000000-0000-0000-0002-000000000024', 'a1000000-0000-0000-0001-000000000003',
   'Développé Militaire Haltères', 2, '10-12', 90, 3, 'vertical_push', ARRAY['dumbbell'], 3, null),
  ('a1000000-0000-0000-0002-000000000025', 'a1000000-0000-0000-0001-000000000003',
   'Planche Isométrique', 3, '20-30s', 60, null, 'core_anti_flex', ARRAY[]::text[], 4, null)
on conflict (id) do nothing;


-- ============================================================
-- ARCHÉTYPE 2 — Hypertrophie Intermédiaire PPL Modifié
-- Objectif : hypertrophy | Niveau : intermediate | 4j/sem. | 10 sem.
-- Rotation : Push / Pull / Legs / Rest / Push2 / Pull2 / Rest
-- ============================================================

insert into public.coach_program_templates
  (id, coach_id, slug, name, description, goal, level, frequency, weeks,
   muscle_tags, equipment_archetype, is_system, is_public, notes)
values (
  'a2000000-0000-0000-0000-000000000002',
  null,
  'system-ppl-hypertrophie-intermediaire',
  'Hypertrophie Intermédiaire – Push/Pull/Legs',
  'Séparation des chaînes musculaires pour augmenter le volume local sans saturer le SNC. Rotation PPL sur 4 jours effectifs avec jours de repos glissants. Idéal pour l''hypertrophie régionale avec surcharge progressive sur exercices d''isolation.',
  'hypertrophy',
  'intermediate',
  4,
  10,
  ARRAY['Pectoraux', 'Épaules', 'Triceps', 'Dos', 'Biceps', 'Jambes'],
  'commercial_gym',
  true,
  true,
  'Repos entre séries : 90–120s pour composés, 60–75s pour isolation. Technique de surcharge progressive : +2.5kg ou +1 rep par semaine. Semaine 5 = deload 60% volume. Semaine 10 = deload final.'
)
on conflict (id) do nothing;

-- Sessions Archétype 2
insert into public.coach_program_template_sessions
  (id, template_id, name, day_of_week, position, notes)
values
  ('a2000000-0000-0000-0001-000000000001', 'a2000000-0000-0000-0000-000000000002', 'Push A — Pectoraux & Épaules & Triceps', 1, 0, 'Exercice principal en composé lourd. Isolation ensuite pour fatiguer localement sans impacter les séances suivantes.'),
  ('a2000000-0000-0000-0001-000000000002', 'a2000000-0000-0000-0000-000000000002', 'Pull A — Dos & Biceps & Deltoïdes Postérieurs', 2, 1, 'Omoplate mobile tout au long de la séance. Biceps travaillés en fin de séance quand les synergistes sont pré-fatigués.'),
  ('a2000000-0000-0000-0001-000000000003', 'a2000000-0000-0000-0000-000000000002', 'Legs — Quadriceps & Ischio-jambiers & Mollets & Tronc', 4, 2, 'Composés en premier. Isolation des IJ en fin de séance. Tronc en dernier — ne pas fatiguer le core avant les composés lombaires.'),
  ('a2000000-0000-0000-0001-000000000004', 'a2000000-0000-0000-0000-000000000002', 'Push B — Volume Épaules & Triceps', 5, 3, 'Seconde séance push : plus de volume épaules et triceps. Pectoraux en entretien.')
on conflict (id) do nothing;

-- Exercices Push A
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a2000000-0000-0000-0002-000000000001', 'a2000000-0000-0000-0001-000000000001',
   'Développé Couché Barre', 4, '6-10', 120, 2, 'horizontal_push', ARRAY['barbell', 'bench', 'rack'], 0,
   'Exercice principal. Emprise légèrement plus large que les épaules. Descente contrôlée 2s, poussée explosive. Toucher la poitrine à chaque rep. Ne pas rebondir.'),
  ('a2000000-0000-0000-0002-000000000002', 'a2000000-0000-0000-0001-000000000001',
   'Développé Incliné Haltères', 3, '8-12', 90, 2, 'horizontal_push', ARRAY['dumbbell', 'bench'], 1,
   'Banc à 30°. Second composé push. Accent sur les faisceaux claviculaires des pectoraux.'),
  ('a2000000-0000-0000-0002-000000000003', 'a2000000-0000-0000-0001-000000000001',
   'Élévation Latérale Haltères', 3, '12-15', 60, 2, 'lateral_raise', ARRAY['dumbbell'], 2,
   'Légère flexion du coude (15°). Élévation dans le plan scapulaire (légèrement en avant). Ne pas dépasser la hauteur des épaules. Descente contrôlée.'),
  ('a2000000-0000-0000-0002-000000000004', 'a2000000-0000-0000-0001-000000000001',
   'Extension Triceps Poulie Haute (Corde)', 3, '10-15', 60, 2, 'elbow_extension', ARRAY['cable_machine'], 3,
   'Coudes fixes sur les hanches. Extension complète en bas, corde écartée. Contraction maximale des triceps en fin de mouvement.'),
  ('a2000000-0000-0000-0002-000000000005', 'a2000000-0000-0000-0001-000000000001',
   'Dips Triceps (machine ou parallèles)', 2, '10-15', 75, 2, 'elbow_extension', ARRAY['dip_bar'], 4,
   'Corps vertical. Coudes proches du corps. Extension complète sans verrouillage. Si dips parallèles : légère inclinaison avant pour cibler davantage les triceps.');

-- Exercices Pull A
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a2000000-0000-0000-0002-000000000011', 'a2000000-0000-0000-0001-000000000002',
   'Tirage Vertical Prise Large (Lat Pulldown)', 4, '6-10', 120, 2, 'vertical_pull', ARRAY['cable_machine'], 0,
   'Exercice principal. Prise pronation, légèrement plus large que les épaules. Omoplate en dépression avant de tirer. Pointer les coudes vers les hanches.'),
  ('a2000000-0000-0000-0002-000000000012', 'a2000000-0000-0000-0001-000000000002',
   'Rowing Câble Horizontal (Barre droite)', 3, '8-12', 90, 2, 'horizontal_pull', ARRAY['cable_machine'], 1,
   'Dos droit, tirage jusqu''au nombril. Omoplate en rétraction complète en fin de mouvement. 1s d''isométrique en position de contraction.'),
  ('a2000000-0000-0000-0002-000000000013', 'a2000000-0000-0000-0001-000000000002',
   'Rowing Haltère Unilatéral', 3, '8-12', 90, 2, 'horizontal_pull', ARRAY['dumbbell', 'bench'], 2,
   'Amplitude maximale. Rotation thoracique légèrement autorisée pour maximiser le stretch du grand dorsal.'),
  ('a2000000-0000-0000-0002-000000000014', 'a2000000-0000-0000-0001-000000000002',
   'Face Pull Poulie Haute (Corde)', 3, '15-20', 60, 2, 'lateral_raise', ARRAY['cable_machine'], 3,
   'Tirage vers le visage, coudes en ligne avec les épaules. Rotation externe en fin de mouvement. Indispensable pour la santé de l''épaule et les deltoïdes postérieurs.'),
  ('a2000000-0000-0000-0002-000000000015', 'a2000000-0000-0000-0001-000000000002',
   'Curl Biceps Barre EZ', 3, '8-12', 75, 2, 'elbow_flexion', ARRAY['barbell_ez'], 4,
   'Coudes fixes contre le corps. Flexion complète, descente contrôlée 3s. Prise supination. Ne pas balancer le torse.'),
  ('a2000000-0000-0000-0002-000000000016', 'a2000000-0000-0000-0001-000000000002',
   'Curl Marteau Haltères', 2, '10-15', 60, 2, 'elbow_flexion', ARRAY['dumbbell'], 5,
   'Prise neutre. Cible le brachial et le brachioradial — épaisseur du bras. Mouvement alterné ou simultané.');

-- Exercices Legs
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a2000000-0000-0000-0002-000000000021', 'a2000000-0000-0000-0001-000000000003',
   'Squat Barre Haut', 4, '6-10', 120, 2, 'squat_pattern', ARRAY['barbell', 'rack'], 0,
   'Exercice principal jambes. Position du rack à hauteur des clavicules. Descent jusqu''au parallèle ou sous le parallèle. Regard droit devant, dos neutre.'),
  ('a2000000-0000-0000-0002-000000000022', 'a2000000-0000-0000-0001-000000000003',
   'Leg Press 45°', 3, '10-15', 90, 2, 'squat_pattern', ARRAY['leg_press'], 1,
   'Pieds à mi-hauteur de la plateforme. Descente jusqu''à 90° de flexion du genou minimum. Ne pas verrouiller les genoux en extension.'),
  ('a2000000-0000-0000-0002-000000000023', 'a2000000-0000-0000-0001-000000000003',
   'Soulevé de Terre Roumain Barre', 3, '8-12', 90, 2, 'hip_hinge', ARRAY['barbell'], 2,
   'Focus ischio-jambiers. Hanches en arrière en priorité. Barre glisse le long des cuisses. S''arrêter quand le dos commence à s''arrondir.'),
  ('a2000000-0000-0000-0002-000000000024', 'a2000000-0000-0000-0001-000000000003',
   'Leg Curl Couché Machine', 3, '10-15', 75, 2, 'knee_flexion', ARRAY['leg_curl_machine'], 3,
   'Hanche légèrement en extension (coussin positionné sur les quadriceps). Flexion complète. 1s d''isométrique en haut. Descente lente 3s.'),
  ('a2000000-0000-0000-0002-000000000025', 'a2000000-0000-0000-0001-000000000003',
   'Leg Extension Machine', 2, '12-15', 60, 2, 'knee_extension', ARRAY['leg_extension_machine'], 4,
   'Extension complète avec 1s d''isométrique au sommet. Ne pas laisser retomber brutalement. Descente contrôlée 3s.'),
  ('a2000000-0000-0000-0002-000000000026', 'a2000000-0000-0000-0001-000000000003',
   'Mollets Debout Machine / Barre', 4, '10-12', 60, 2, 'calf_raise', ARRAY['calf_raise_machine'], 5,
   'Amplitude complète : descente maximale en bas (étirement complet), extension maximale en haut. 1s d''isométrique en haut. Ne pas rebondir en bas.'),
  ('a2000000-0000-0000-0002-000000000027', 'a2000000-0000-0000-0001-000000000003',
   'Crunch Câble', 3, '12-15', 60, 2, 'core_flex', ARRAY['cable_machine'], 6,
   'Agenouillé face à la poulie haute. Flexion de la colonne — pas des hanches. Contraction maximale en bas.');

-- Exercices Push B
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a2000000-0000-0000-0002-000000000031', 'a2000000-0000-0000-0001-000000000004',
   'Développé Militaire Barre Debout', 4, '6-10', 120, 2, 'vertical_push', ARRAY['barbell', 'rack'], 0,
   'Exercice principal Push B. Prise légèrement plus large que les épaules. Verrouillage complet en haut. Coudes légèrement en avant de la barre en bas.'),
  ('a2000000-0000-0000-0002-000000000032', 'a2000000-0000-0000-0001-000000000004',
   'Développé Couché Haltères', 3, '8-12', 90, 2, 'horizontal_push', ARRAY['dumbbell', 'bench'], 1,
   'Entretien pectoraux. Amplitude maximale — haltères au niveau des épaules en bas.'),
  ('a2000000-0000-0000-0002-000000000033', 'a2000000-0000-0000-0001-000000000004',
   'Élévation Latérale Câble Unilatéral', 3, '12-15', 60, 2, 'lateral_raise', ARRAY['cable_machine'], 2,
   'Câble bas, bras croisé. Tension constante sur le deltoïde médian tout au long du mouvement — avantage sur les haltères en bas du mouvement.'),
  ('a2000000-0000-0000-0002-000000000034', 'a2000000-0000-0000-0001-000000000004',
   'Élévation Frontale Haltères Alternée', 2, '10-12', 60, 2, 'vertical_push', ARRAY['dumbbell'], 3,
   'Prise neutre ou pronation. Élévation jusqu''à hauteur des épaules. Ne pas balancer le torse.'),
  ('a2000000-0000-0000-0002-000000000035', 'a2000000-0000-0000-0001-000000000004',
   'Extension Triceps Barre EZ au-dessus de la Tête', 3, '10-15', 75, 2, 'elbow_extension', ARRAY['barbell_ez', 'bench'], 4,
   'Assis ou couché. Coudes fixes. Extension complète au-dessus. Cible le chef long du triceps (portion la plus volumineuse).')
on conflict (id) do nothing;


-- ============================================================
-- ARCHÉTYPE 3 — Force Maximale Upper/Lower
-- Objectif : strength | Niveau : advanced | 4j/sem. | 12 sem.
-- Deload programmé semaines 6 et 12
-- ============================================================

insert into public.coach_program_templates
  (id, coach_id, slug, name, description, goal, level, frequency, weeks,
   muscle_tags, equipment_archetype, is_system, is_public, notes)
values (
  'a3000000-0000-0000-0000-000000000003',
  null,
  'system-force-upper-lower',
  'Force Maximale – Upper/Lower',
  'Optimisation de la force neuromusculaire. Focalisation sur les leviers mécaniques lourds et le recrutement des unités motrices à haut seuil. Temps de repos stricts et obligatoires (3 à 5 minutes) entre séries de travail. Volume d''assistance minimal.',
  'strength',
  'advanced',
  4,
  12,
  ARRAY['Full Body', 'Ceinture Scapulaire', 'Ceinture Pelvienne'],
  'commercial_gym',
  true,
  true,
  'Repos entre séries de travail : 3 à 5 minutes — non négociable. Deload programmé semaines 6 et 12 : 60% de la charge, même technique. Progressions : méthode des doubles (passer de 5×3 à 5×5 avant d''augmenter la charge). Ne jamais raté une rep en séance de force.'
)
on conflict (id) do nothing;

-- Sessions Archétype 3
insert into public.coach_program_template_sessions
  (id, template_id, name, day_of_week, position, notes)
values
  ('a3000000-0000-0000-0001-000000000001', 'a3000000-0000-0000-0000-000000000003', 'Upper A — Force Haut du Corps (Poussée dominante)', 1, 0, 'Développé couché comme mouvement principal. Tirage lourd en second. Assistance minimale.'),
  ('a3000000-0000-0000-0001-000000000002', 'a3000000-0000-0000-0000-000000000003', 'Lower A — Force Bas du Corps (Squat dominant)', 2, 1, 'Squat barre comme mouvement principal. Travail complémentaire hinge. Aucun exercice d''isolation.'),
  ('a3000000-0000-0000-0001-000000000003', 'a3000000-0000-0000-0000-000000000003', 'Upper B — Force Haut du Corps (Traction dominante)', 4, 2, 'Développé militaire et tirage horizontal comme mouvements principaux. Assistance biceps/triceps courte.'),
  ('a3000000-0000-0000-0001-000000000004', 'a3000000-0000-0000-0000-000000000003', 'Lower B — Force Bas du Corps (Hinge dominant)', 5, 3, 'Soulevé de terre comme mouvement principal. Fente pour travail unilatéral. Gainage en fin de séance.')
on conflict (id) do nothing;

-- Exercices Upper A
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a3000000-0000-0000-0002-000000000001', 'a3000000-0000-0000-0001-000000000001',
   'Développé Couché Barre', 5, '3-5', 240, 1, 'horizontal_push', ARRAY['barbell', 'bench', 'rack'], 0,
   'Mouvement principal. Charge à 85-90% 1RM. Emprise pronation 81cm. Arc lombaire modéré autorisé. Ne jamais bouncer la barre sur la poitrine. Paré obligatoire.'),
  ('a3000000-0000-0000-0002-000000000002', 'a3000000-0000-0000-0001-000000000001',
   'Tirage Horizontal Barre (Barbell Row)', 4, '4-6', 180, 1, 'horizontal_pull', ARRAY['barbell'], 1,
   'Torse parallèle au sol. Barre tirée vers le nombril. Même placement que le soulevé de terre pour le bas du dos. Ne pas tromper avec le momentum.'),
  ('a3000000-0000-0000-0002-000000000003', 'a3000000-0000-0000-0001-000000000001',
   'Développé Incliné Barre', 3, '5-6', 180, 1, 'horizontal_push', ARRAY['barbell', 'bench', 'rack'], 2,
   'Assistance du développé couché. Banc à 30°. Charge à 70-75% 1RM développé couché.'),
  ('a3000000-0000-0000-0002-000000000004', 'a3000000-0000-0000-0001-000000000001',
   'Dips Lestés', 3, '6-8', 120, 1, 'elbow_extension', ARRAY['dip_bar', 'dip_belt'], 3,
   'Lest via ceinture de lest. Corps légèrement incliné en avant pour cible pectoraux. Extension complète. Assistance triceps.'),
  ('a3000000-0000-0000-0002-000000000005', 'a3000000-0000-0000-0001-000000000001',
   'Curl Biceps Barre Droite', 3, '6-8', 90, 2, 'elbow_flexion', ARRAY['barbell'], 4,
   'Assistance biceps courte. Coudes fixes. Descente contrôlée 3s.');

-- Exercices Lower A
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a3000000-0000-0000-0002-000000000011', 'a3000000-0000-0000-0001-000000000002',
   'Squat Barre Haut', 5, '3-5', 300, 1, 'squat_pattern', ARRAY['barbell', 'rack'], 0,
   'Mouvement principal. 85-90% 1RM. Descente jusqu''au parallèle ou en-dessous. Talons ancrés, genoux dans l''axe. Aucune ascension avec les talons. Paré obligatoire.'),
  ('a3000000-0000-0000-0002-000000000012', 'a3000000-0000-0000-0001-000000000002',
   'Squat Pause (2s en bas)', 3, '3-4', 180, 2, 'squat_pattern', ARRAY['barbell', 'rack'], 1,
   '70-75% 1RM. Pause stricte 2 secondes en bas de course. Élimine le rebond du stretch reflex. Développe la force dans la position basse.'),
  ('a3000000-0000-0000-0002-000000000013', 'a3000000-0000-0000-0001-000000000002',
   'Leg Press 45° Pieds Hauts', 3, '8-10', 120, 2, 'squat_pattern', ARRAY['leg_press'], 2,
   'Pieds hauts sur la plateforme — accent ischio-jambiers et fessiers. Volume complémentaire sans stress lombaire supplémentaire.'),
  ('a3000000-0000-0000-0002-000000000014', 'a3000000-0000-0000-0001-000000000002',
   'Gainage Planche Lestée', 3, '30-45s', 90, null, 'core_anti_flex', ARRAY['weight_plate'], 3,
   'Disque posé sur le bas du dos. Bassin en rétroversion. Respiration normale. Tronc fort = levier fort sur le squat.');

-- Exercices Upper B
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a3000000-0000-0000-0002-000000000021', 'a3000000-0000-0000-0001-000000000003',
   'Développé Militaire Barre Debout', 5, '3-5', 240, 1, 'vertical_push', ARRAY['barbell', 'rack'], 0,
   'Mouvement principal. Emprise légèrement plus large que les épaules. Verrouillage complet en haut. Gainage abdominal maximal — pas de cambrure excessive.'),
  ('a3000000-0000-0000-0002-000000000022', 'a3000000-0000-0000-0001-000000000003',
   'Traction Lestée Prise Large', 4, '4-6', 180, 1, 'vertical_pull', ARRAY['pull_up_bar', 'dip_belt'], 1,
   'Prise pronation. Amplitude complète — bras tendus en bas. Menton au-dessus de la barre en haut. Lest progressif.'),
  ('a3000000-0000-0000-0002-000000000023', 'a3000000-0000-0000-0001-000000000003',
   'Rowing Barbell Penché', 4, '4-6', 180, 1, 'horizontal_pull', ARRAY['barbell'], 2,
   'Même structure que Upper A mais accent tirage. Barre vers le nombril. Isométrique 1s en haut.'),
  ('a3000000-0000-0000-0002-000000000024', 'a3000000-0000-0000-0001-000000000003',
   'Extension Triceps Couché Barre EZ (Skullcrusher)', 3, '6-8', 90, 2, 'elbow_extension', ARRAY['barbell_ez', 'bench'], 3,
   'Assistance triceps. Barre descend derrière la tête (pas vers le front). Chef long maximalement étiré.'),
  ('a3000000-0000-0000-0002-000000000025', 'a3000000-0000-0000-0001-000000000003',
   'Curl Incliné Haltères', 3, '6-8', 90, 2, 'elbow_flexion', ARRAY['dumbbell', 'bench'], 4,
   'Banc incliné à 45°. Étirement maximal du biceps en bas. Recrutement accru du chef long du biceps.');

-- Exercices Lower B
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a3000000-0000-0000-0002-000000000031', 'a3000000-0000-0000-0001-000000000004',
   'Soulevé de Terre Conventionnel', 5, '3-5', 300, 1, 'hip_hinge', ARRAY['barbell'], 0,
   'Mouvement principal. 85-90% 1RM. Barre en contact avec les tibias. Double overhand ou mixte. Expiration avant la poussée du sol. Ne jamais arrondir le dos.'),
  ('a3000000-0000-0000-0002-000000000032', 'a3000000-0000-0000-0001-000000000004',
   'Soulevé de Terre Roumain Barre', 3, '5-6', 180, 2, 'hip_hinge', ARRAY['barbell'], 1,
   'Assistance SDT. 60-70% 1RM SDT. Focus sur l''étirement des ischio-jambiers. Renforce la chaîne postérieure sans stress neuronal excessif.'),
  ('a3000000-0000-0000-0002-000000000033', 'a3000000-0000-0000-0001-000000000004',
   'Fente Marchée Haltères', 3, '6-8/jambe', 120, 2, 'squat_pattern', ARRAY['dumbbell'], 2,
   'Travail unilatéral. Déséquilibres corrigés. Genou avant ne dépasse pas les orteils. Torse droit.'),
  ('a3000000-0000-0000-0002-000000000034', 'a3000000-0000-0000-0001-000000000004',
   'Hip Thrust Barre Lourde', 3, '6-8', 120, 2, 'hip_hinge', ARRAY['barbell', 'bench'], 3,
   'Barbell sur les hanches (pad de protection). Extension maximale. Fessiers prioritaires.'),
  ('a3000000-0000-0000-0002-000000000035', 'a3000000-0000-0000-0001-000000000004',
   'Gainage Pallof Press', 3, '8-10/côté', 90, null, 'core_anti_flex', ARRAY['cable_machine'], 4,
   'Résistance à la rotation. Renforce le gainage anti-rotation. Indispensable pour stabiliser le bassin sous charges lourdes.')
on conflict (id) do nothing;


-- ============================================================
-- ARCHÉTYPE 4 — Recomposition Densité & Circuits
-- Objectif : recomp | Niveau : intermediate | 3j/sem. | 6 sem.
-- Supersets antagonistes — rest réduit entre supersets
-- ============================================================

insert into public.coach_program_templates
  (id, coach_id, slug, name, description, goal, level, frequency, weeks,
   muscle_tags, equipment_archetype, is_system, is_public, notes)
values (
  'a4000000-0000-0000-0000-000000000004',
  null,
  'system-recomposition-densite-circuits',
  'Recomposition – Densité & Circuits',
  'Augmentation du travail accompli par unité de temps via supersets antagonistes. Maintien d''une tension mécanique suffisante pour préserver la masse musculaire tout en stimulant la dépense énergétique. 6 semaines maximum — la tolérance à la haute densité chute rapidement.',
  'recomp',
  'intermediate',
  3,
  6,
  ARRAY['Full Body', 'Tronc', 'Cardiovasculaire'],
  'commercial_gym',
  true,
  true,
  'Structure supersets : A1 + A2 sans repos entre les deux, puis 45-60s de repos avant le prochain superset. Rythme cardiaque cible : 65-75% FC max. Ne pas sacrifier la technique pour la densité. Si form breakdown : augmenter le repos.'
)
on conflict (id) do nothing;

-- Sessions Archétype 4
insert into public.coach_program_template_sessions
  (id, template_id, name, day_of_week, position, notes)
values
  ('a4000000-0000-0000-0001-000000000001', 'a4000000-0000-0000-0000-000000000004', 'Séance A — Supersets Poussée/Tirage Horizontal', 1, 0, 'Supersets A1+A2, B1+B2, C1+C2. Repos 45-60s entre supersets. Rythme élevé maintenu.'),
  ('a4000000-0000-0000-0001-000000000002', 'a4000000-0000-0000-0000-000000000004', 'Séance B — Supersets Bas du Corps & Vertical', 3, 1, 'Accent jambes + traction verticale en antagoniste des poussées verticales. Tronc intégré.'),
  ('a4000000-0000-0000-0001-000000000003', 'a4000000-0000-0000-0000-000000000004', 'Séance C — Full Body Métabolique (Circuit)', 5, 2, 'Circuit 4 exercices, 3 tours. Repos 60s entre tours. Tempo élevé mais contrôlé.')
on conflict (id) do nothing;

-- Exercices Séance A (supersets — position paire = A1, impaire = A2 pour simplification)
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a4000000-0000-0000-0002-000000000001', 'a4000000-0000-0000-0001-000000000001',
   'A1 — Développé Couché Haltères', 4, '10-12', 0, 3, 'horizontal_push', ARRAY['dumbbell', 'bench'], 0,
   'SUPERSET avec A2. Enchaîner immédiatement avec le rowing. Repos 50s après A2 avant le prochain superset.'),
  ('a4000000-0000-0000-0002-000000000002', 'a4000000-0000-0000-0001-000000000001',
   'A2 — Rowing Câble Horizontal', 4, '10-12', 50, 3, 'horizontal_pull', ARRAY['cable_machine'], 1,
   'SUPERSET avec A1. Antagoniste direct du développé — récupération musculaire partielle pendant l''exécution.'),
  ('a4000000-0000-0000-0002-000000000003', 'a4000000-0000-0000-0001-000000000001',
   'B1 — Hip Thrust Haltère', 3, '12-15', 0, 3, 'hip_hinge', ARRAY['dumbbell', 'bench'], 2,
   'SUPERSET avec B2. Fessiers + ischio-jambiers.'),
  ('a4000000-0000-0000-0002-000000000004', 'a4000000-0000-0000-0001-000000000001',
   'B2 — Fente Avant Haltères', 3, '10/jambe', 50, 3, 'squat_pattern', ARRAY['dumbbell'], 3,
   'SUPERSET avec B1. Quadriceps dominant en antagoniste fonctionnel des fessiers.'),
  ('a4000000-0000-0000-0002-000000000005', 'a4000000-0000-0000-0001-000000000001',
   'C1 — Développé Militaire Haltères', 3, '12-15', 0, 3, 'vertical_push', ARRAY['dumbbell'], 4,
   'SUPERSET avec C2. Épaules + gainage.'),
  ('a4000000-0000-0000-0002-000000000006', 'a4000000-0000-0000-0001-000000000001',
   'C2 — Planche Dynamique (Mountain Climbers)', 3, '20 reps', 50, null, 'core_anti_flex', ARRAY[]::text[], 5,
   'SUPERSET avec C1. Élève le rythme cardiaque + tronc. Pieds restent proches du sol, bassin stable.');

-- Exercices Séance B
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a4000000-0000-0000-0002-000000000011', 'a4000000-0000-0000-0001-000000000002',
   'A1 — Squat Goblet', 4, '12-15', 0, 3, 'squat_pattern', ARRAY['dumbbell'], 0,
   'SUPERSET avec A2.'),
  ('a4000000-0000-0000-0002-000000000012', 'a4000000-0000-0000-0001-000000000002',
   'A2 — Tirage Vertical Poulie (Lat Pulldown)', 4, '10-12', 50, 3, 'vertical_pull', ARRAY['cable_machine'], 1,
   'SUPERSET avec A1. Antagoniste vertical — haut du corps se repose pendant le bas et vice versa.'),
  ('a4000000-0000-0000-0002-000000000013', 'a4000000-0000-0000-0001-000000000002',
   'B1 — Soulevé de Terre Roumain Haltères', 3, '12-15', 0, 3, 'hip_hinge', ARRAY['dumbbell'], 2,
   'SUPERSET avec B2. Ischio-jambiers pré-fatigués.'),
  ('a4000000-0000-0000-0002-000000000014', 'a4000000-0000-0000-0001-000000000002',
   'B2 — Développé Militaire Haltères Assis', 3, '12-15', 50, 3, 'vertical_push', ARRAY['dumbbell', 'bench'], 3,
   'SUPERSET avec B1. Antagoniste fonctionnel : bas du corps/haut du corps.'),
  ('a4000000-0000-0000-0002-000000000015', 'a4000000-0000-0000-0001-000000000002',
   'C — Burpee Simplifié (sans saut)', 3, '10 reps', 60, null, 'core_anti_flex', ARRAY[]::text[], 4,
   'Finisher cardiovasculaire. Pas de saut si genou fragile. Tempo contrôlé — pas une course.');

-- Exercices Séance C (circuit)
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a4000000-0000-0000-0002-000000000021', 'a4000000-0000-0000-0001-000000000003',
   'Squat Haltères', 3, '15', 15, 3, 'squat_pattern', ARRAY['dumbbell'], 0,
   'CIRCUIT — enchaîner les 4 exercices. 15s de transition entre exercices dans le circuit. 60s de repos après les 4 exercices.'),
  ('a4000000-0000-0000-0002-000000000022', 'a4000000-0000-0000-0001-000000000003',
   'Rowing Haltère Debout (Tronc Penché)', 3, '12/côté', 15, 3, 'horizontal_pull', ARRAY['dumbbell'], 1,
   'CIRCUIT — sec.'),
  ('a4000000-0000-0000-0002-000000000023', 'a4000000-0000-0000-0001-000000000003',
   'Développé Haltères Debout (Arnold Press)', 3, '12', 15, 3, 'vertical_push', ARRAY['dumbbell'], 2,
   'CIRCUIT — rotation supination/pronation pendant la poussée. Stimulus deltoïdes antérieur + médian.'),
  ('a4000000-0000-0000-0002-000000000024', 'a4000000-0000-0000-0001-000000000003',
   'Hip Thrust au Sol (Glute Bridge) Lest', 3, '15', 60, 3, 'hip_hinge', ARRAY['weight_plate'], 3,
   'CIRCUIT — finit le tour. Disque sur le bas-ventre. Extension maximale de hanche. 60s repos puis recommencer le circuit.')
on conflict (id) do nothing;


-- ============================================================
-- ARCHÉTYPE 5 — Spécialisation Chaîne Postérieure Dominante
-- Objectif : hypertrophy | Niveau : intermediate | 3j/sem. | 8 sem.
-- ============================================================

insert into public.coach_program_templates
  (id, coach_id, slug, name, description, goal, level, frequency, weeks,
   muscle_tags, equipment_archetype, is_system, is_public, notes)
values (
  'a5000000-0000-0000-0000-000000000005',
  null,
  'system-specialisation-chaine-posterieure',
  'Spécialisation – Chaîne Postérieure Dominante',
  'Déséquilibre volontaire du volume d''entraînement pour corriger les faiblesses posturales modernes ou répondre à une demande esthétique spécifique. Dominance extrême sur les ischio-jambiers, grand et moyen fessier, érecteurs du rachis, lombaires. Le haut du corps est maintenu en volume de simple maintenance.',
  'hypertrophy',
  'intermediate',
  3,
  8,
  ARRAY['Fessiers', 'Ischio-jambiers', 'Lombaires', 'Dos', 'Mollets'],
  'commercial_gym',
  true,
  true,
  'Volume chaîne postérieure : 60-70% du volume total. Volume haut du corps : 30-40% (maintenance). Ne pas spécialiser au-delà de 10 semaines sans transition. Progressions hebdomadaires sur les mouvements principaux (hip thrust, RDL, leg curl). Repos entre séries : 90-120s.'
)
on conflict (id) do nothing;

-- Sessions Archétype 5
insert into public.coach_program_template_sessions
  (id, template_id, name, day_of_week, position, notes)
values
  ('a5000000-0000-0000-0001-000000000001', 'a5000000-0000-0000-0000-000000000005', 'Jour A — Hinge & Fessiers Dominants', 1, 0, 'Hip thrust et RDL en exercices principaux. Volume ischio-jambiers élevé. Haut du corps en maintenance rapide en fin de séance.'),
  ('a5000000-0000-0000-0001-000000000002', 'a5000000-0000-0000-0000-000000000005', 'Jour B — Fessiers & Ischio-jambiers Volume', 3, 1, 'Volume maximal sur la chaîne postérieure basse. Exercises complémentaires pour érecteurs et lombaires.'),
  ('a5000000-0000-0000-0001-000000000003', 'a5000000-0000-0000-0000-000000000005', 'Jour C — Maintenance Haut du Corps & Complément Postérieur', 5, 2, 'Dos + épaules + poitrine en maintenance (2-3 séries, pas de progression recherchée). Complément chaîne postérieure en fin de séance.')
on conflict (id) do nothing;

-- Exercices Jour A
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a5000000-0000-0000-0002-000000000001', 'a5000000-0000-0000-0001-000000000001',
   'Hip Thrust Barre', 4, '8-12', 120, 2, 'hip_hinge', ARRAY['barbell', 'bench'], 0,
   'Exercice principal Jour A. Pad de protection sur les hanches. Pieds à plat, dans l''axe des genoux. Extension complète — bassin vertical en haut. Contraction isométrique 1s en position haute.'),
  ('a5000000-0000-0000-0002-000000000002', 'a5000000-0000-0000-0001-000000000001',
   'Soulevé de Terre Roumain Barre', 4, '8-12', 120, 2, 'hip_hinge', ARRAY['barbell'], 1,
   'Hanches reculées en premier. Étirement maximal des ischio-jambiers. Arrêt juste sous les genoux. Dos strictement neutre pendant tout le mouvement.'),
  ('a5000000-0000-0000-0002-000000000003', 'a5000000-0000-0000-0001-000000000001',
   'Fente Bulgare Haltères', 3, '10-12/jambe', 90, 2, 'squat_pattern', ARRAY['dumbbell', 'bench'], 2,
   'Pied arrière surélevé sur le banc. Descente verticale — genou avant dans l''axe du pied. Forte activation du grand fessier si torse légèrement penché en avant.'),
  ('a5000000-0000-0000-0002-000000000004', 'a5000000-0000-0000-0001-000000000001',
   'Good Morning Barre Légère', 3, '12-15', 90, 3, 'hip_hinge', ARRAY['barbell'], 3,
   'Barre basse sur le dos (position squat basse). Flexion de hanche avec genou légèrement fléchi. Érecteurs et ischio-jambiers co-contractés. Charge légère — exercice de gainage dynamique.'),
  ('a5000000-0000-0000-0002-000000000005', 'a5000000-0000-0000-0001-000000000001',
   'Rowing Barre Penché (maintenance dos)', 2, '10-12', 90, 3, 'horizontal_pull', ARRAY['barbell'], 4,
   'Maintenance du grand dorsal et des trapèzes. Pas de progression recherchée — maintenir la masse acquise.');

-- Exercices Jour B
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a5000000-0000-0000-0002-000000000011', 'a5000000-0000-0000-0001-000000000002',
   'Soulevé de Terre Sumo', 4, '6-10', 150, 2, 'hip_hinge', ARRAY['barbell'], 0,
   'Exercice principal Jour B. Position pieds larges (30-45° d''angle). Fessiers et adducteurs fortement sollicités. Barre sur le milieu du pied. Dos droit, poitrine haute.'),
  ('a5000000-0000-0000-0002-000000000012', 'a5000000-0000-0000-0001-000000000002',
   'Leg Curl Couché Machine', 4, '10-15', 75, 2, 'knee_flexion', ARRAY['leg_curl_machine'], 1,
   'Isolement des ischio-jambiers en flexion du genou. Hanche en légère extension (coussin sous les quadriceps). Descente lente 3s. Isométrique 1s en haut. Volume élevé — 4 séries.'),
  ('a5000000-0000-0000-0002-000000000013', 'a5000000-0000-0000-0001-000000000002',
   'Hip Thrust Unilatéral (une jambe)', 3, '12-15/jambe', 90, 2, 'hip_hinge', ARRAY['bench'], 2,
   'Jambe libre fléchie à 90°. Extension complète de la jambe de travail. Corrige les déséquilibres fessiers entre les côtés.'),
  ('a5000000-0000-0000-0002-000000000014', 'a5000000-0000-0000-0001-000000000002',
   'Hyperextension 45° (Back Extension)', 4, '12-15', 75, 2, 'hip_hinge', ARRAY['back_extension_bench'], 3,
   'Banc à 45°. Extension jusqu''à la position horizontale maximum. Ne pas hyperextendre la lombaire. Peut être lestée avec un disque contre la poitrine. Cible les érecteurs et le grand fessier.'),
  ('a5000000-0000-0000-0002-000000000015', 'a5000000-0000-0000-0001-000000000002',
   'Mollets Assis Machine', 3, '12-15', 60, 2, 'calf_raise', ARRAY['seated_calf_machine'], 4,
   'Cible le soléaire (muscle profond du mollet). Amplitude complète indispensable. 1s d''isométrique en haut.');

-- Exercices Jour C
insert into public.coach_program_template_exercises
  (id, session_id, name, sets, reps, rest_sec, rir, movement_pattern, equipment_required, position, notes)
values
  ('a5000000-0000-0000-0002-000000000021', 'a5000000-0000-0000-0001-000000000003',
   'Tirage Vertical Poulie (Lat Pulldown)', 3, '10-12', 90, 3, 'vertical_pull', ARRAY['cable_machine'], 0,
   'Maintenance grand dorsal. Pas de progression de charge — maintenir la masse.'),
  ('a5000000-0000-0000-0002-000000000022', 'a5000000-0000-0000-0001-000000000003',
   'Développé Couché Haltères', 3, '10-12', 90, 3, 'horizontal_push', ARRAY['dumbbell', 'bench'], 1,
   'Maintenance pectoraux et deltoïdes antérieurs. Pas de progression recherchée.'),
  ('a5000000-0000-0000-0002-000000000023', 'a5000000-0000-0000-0001-000000000003',
   'Face Pull Poulie Haute', 3, '15-20', 60, 3, 'lateral_raise', ARRAY['cable_machine'], 2,
   'Santé de l''épaule. Rotation externe + rétraction omoplate. Maintien des deltoïdes postérieurs.'),
  ('a5000000-0000-0000-0002-000000000024', 'a5000000-0000-0000-0001-000000000003',
   'Nordic Curl Assisté (ou Leg Curl Nordique)', 3, '6-8', 90, 2, 'knee_flexion', ARRAY['nordic_curl_anchor'], 3,
   'Si nordique impossible sans assistance : utiliser une bande élastique. Descente maximale en contrôle excentrique. Exercice avancé de renforcement ischio-jambiers en excentrique.'),
  ('a5000000-0000-0000-0002-000000000025', 'a5000000-0000-0000-0001-000000000003',
   'Soulevé de Terre Roumain Haltères Léger (Finisher)', 3, '15-20', 75, 4, 'hip_hinge', ARRAY['dumbbell'], 4,
   'Poids léger, amplitude maximale, tempo lent. Finisher chaîne postérieure — blood flow + étirement dynamique sous charge.')
on conflict (id) do nothing;

-- ============================================================
-- Vérification post-seed (à exécuter séparément si besoin)
-- select slug, name, goal, level, frequency, weeks
-- from public.coach_program_templates
-- where is_system = true
-- order by created_at;
-- ============================================================
