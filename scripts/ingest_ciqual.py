import xml.etree.ElementTree as ET
import sqlite3
import os

# Configuration des chemins relatifs à la racine de ton repo
RAW_DIR = "data/raw/ciqual_2025"
PROCESSED_DIR = "data/processed"
DB_PATH = os.path.join(PROCESSED_DIR, "ciqual.sqlite")

# Mappage des codes de constituants CIQUAL vers nos colonnes
# 328: Energie (kcal), 400: Protéines (g), 410: Glucides (g), 420: Lipides (g)
TARGET_CONST = {
    '328': 'calories',
    '400': 'proteines',
    '410': 'glucides',
    '420': 'lipides'
}

def clean_value(text):
    """Nettoie les chaînes du CIQUAL pour les convertir en nombres exploitables."""
    if text is None:
        return 0.0
    # Remplace virgule par point, retire les symboles d'infériorité et espaces
    clean_txt = text.replace(',', '.').replace('<', '').strip()
    try:
        return float(clean_txt)
    except ValueError:
        return 0.0

def ingest():
    # Création du dossier processed s'il n'existe pas
    if not os.path.exists(PROCESSED_DIR):
        os.makedirs(PROCESSED_DIR)

    # Connexion à SQLite
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("--- 🛠️  Phase 1 : Création des tables ---")
    cursor.execute("DROP TABLE IF EXISTS aliments")
    cursor.execute("""
        CREATE TABLE aliments (
            id INTEGER PRIMARY KEY,
            nom_fr TEXT,
            calories REAL DEFAULT 0,
            proteines REAL DEFAULT 0,
            glucides REAL DEFAULT 0,
            lipides REAL DEFAULT 0
        )
    """)

    # 1. Traitement des noms (alim.xml)
    alim_path = os.path.join(RAW_DIR, "alim_2025_11_03.xml")
    print(f"Lecture de : {alim_path}")

    tree_alim = ET.parse(alim_path)
    root_alim = tree_alim.getroot()

    aliments_batch = []
    for alim in root_alim.findall('ALIM'):
        code = int(alim.find('alim_code').text.strip())
        nom = alim.find('alim_nom_fr').text.strip()
        aliments_batch.append((code, nom))

    cursor.executemany("INSERT INTO aliments (id, nom_fr) VALUES (?, ?)", aliments_batch)
    print(f"✅ {len(aliments_batch)} aliments enregistrés.")

    # 2. Traitement des compositions (compo.xml)
    compo_path = os.path.join(RAW_DIR, "compo_2025_11_03.xml")
    print(f"Lecture de : {compo_path} (Patience...)")

    tree_compo = ET.parse(compo_path)
    root_compo = tree_compo.getroot()

    # Dictionnaire temporaire pour stocker les macros par aliment
    nutrition_map = {}

    for compo in root_compo.findall('COMPO'):
        alim_code = int(compo.find('alim_code').text.strip())
        const_code = compo.find('const_code').text.strip()

        if const_code in TARGET_CONST:
            col = TARGET_CONST[const_code]
            val = clean_value(compo.find('teneur').text)

            if alim_code not in nutrition_map:
                nutrition_map[alim_code] = {}
            nutrition_map[alim_code][col] = val

    # 3. Mise à jour massive de la table
    print("Mise à jour des macros-nutriments...")
    update_data = []
    for code, macros in nutrition_map.items():
        update_data.append((
            macros.get('calories', 0),
            macros.get('proteines', 0),
            macros.get('glucides', 0),
            macros.get('lipides', 0),
            code
        ))

    cursor.executemany("""
        UPDATE aliments
        SET calories = ?, proteines = ?, glucides = ?, lipides = ?
        WHERE id = ?
    """, update_data)

    conn.commit()
    conn.close()
    print("--- 🚀 Ingestion terminée avec succès ! ---")
    print(f"Fichier créé : {DB_PATH}")

if __name__ == "__main__":
    ingest()
