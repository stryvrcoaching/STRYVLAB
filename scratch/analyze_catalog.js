const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data/exercise-catalog.json', 'utf8'));

console.log('--- STATISTIQUES GLOBALES ---');
console.log(`Nombre total d'exercices dans le catalogue : ${data.length}`);

// 1. Types d'exercices
const types = {};
data.forEach(ex => {
  types[ex.exerciseType] = (types[ex.exerciseType] || 0) + 1;
});
console.log('\nDistribution des types :');
console.dir(types);

// 2. Équipements
const equipmentCounts = {};
data.forEach(ex => {
  if (ex.equipment && Array.isArray(ex.equipment)) {
    ex.equipment.forEach(eq => {
      equipmentCounts[eq] = (equipmentCounts[eq] || 0) + 1;
    });
  } else {
    equipmentCounts['sans_equipement'] = (equipmentCounts['sans_equipement'] || 0) + 1;
  }
});
console.log('\nDistribution des équipements :');
console.dir(equipmentCounts);

// 3. Modèles de mouvement (patterns / movementPattern)
const patterns = {};
data.forEach(ex => {
  const p = ex.movementPattern || 'non_defini';
  patterns[p] = (patterns[p] || 0) + 1;
});
console.log('\nDistribution des patterns de mouvement (movementPattern) :');
console.dir(patterns);

// 4. Catégories / muscle groups
const muscleGroups = {};
data.forEach(ex => {
  const mg = ex.muscleGroup || 'non_defini';
  muscleGroups[mg] = (muscleGroups[mg] || 0) + 1;
});
console.log('\nDistribution par groupe musculaire :');
console.dir(muscleGroups);

// 5. Recherche d'exercices liés au cardio
console.log('\n--- ANALYSE CARDIO / CONDITIONING ---');
const cardioKeywords = ['run', 'course', 'velo', 'bike', 'cardio', 'jump', 'rope', 'corde', 'rameur', 'rower', 'elliptical', 'burpee', 'jumping', 'jack', 'tapis', 'stair', 'skipping', 'hiit', 'metabolic', 'circuits'];
const cardioExs = data.filter(ex => {
  const text = `${ex.name} ${ex.slug} ${ex.movementPattern} ${(ex.pattern || []).join(' ')}`.toLowerCase();
  return cardioKeywords.some(kw => text.includes(kw));
});

console.log(`Nombre d'exercices potentiellement liés au cardio/HIIT/conditioning : ${cardioExs.length}`);
console.log('Exemples :');
cardioExs.slice(0, 15).forEach(ex => {
  console.log(`- [${ex.movementPattern}] ${ex.name} (Slug: ${ex.slug}, Equip: ${ex.equipment?.join(', ')})`);
});
