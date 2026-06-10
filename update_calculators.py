#!/usr/bin/env python3
import re
import os

# Remplacements CSS globaux
replacements = [
    # Section background
    (r'<section className="py-24 px-6 md:px-12 lg:px-24">', r'<section className="py-24 px-6 md:px-12 lg:px-24 bg-white">'),
    
    # Headers
    (r'text-4xl font-light mb-4', r'text-4xl font-bold mb-4 text-black" style={{ letterSpacing: \'-0.05em\' }}'),
    (r'text-lg text-gray-400', r'text-lg text-gray-600'),
    (r'text-sm text-gray-500', r'text-sm text-gray-600 font-medium'),
    
    # Inputs
    (r'bg-white/\[0\.02\]', r'bg-white'),
    (r'border border-white/10', r'border-2 border-gray-300'),
    (r'rounded-lg', r'rounded-2xl'),
    (r'focus:border-electric-emerald', r'focus:border-blue-600'),
    (r'text-white', r'text-black'),
    (r'text-gray-400.*text-white', r'text-gray-400.*text-black'),
    
    # Buttons/Selects
    (r'bg-white/\[0\.02\] border border-white/10 rounded-lg text-white', r'bg-white border-2 border-gray-300 rounded-2xl text-black'),
    
    # Results
    (r'text-electric-emerald', r'text-blue-600 font-bold'),
    (r'border-t border-white/10', r'border-t border-gray-200'),
    (r'bg-white/\[0\.02\]', r'bg-white'),
    (r'border border-white/10', r'border-2 border-gray-200'),
    
    # Labels
    (r'text-gray-500.*mb-2', r'text-gray-600 font-medium mb-2'),
]

files = [
    'app/components/calculators/BodyFatCalculator.tsx',
    'app/components/calculators/HRZonesCalculator.tsx',
    'app/components/calculators/OneRMCalculator.tsx',
    'app/components/calculators/WaterIntakeCalculator.tsx',
]

for file_path in files:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
    
    # Ajustements spécifiques pour les cas complexes
    # Fix pour les inputs avec condition text-gray-400/text-white
    content = re.sub(
        r"className=\{`w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-2xl focus:border-blue-600 focus:outline-none \$\{([^}]+) === '' \? 'text-gray-400' : 'text-black'\}`\}",
        r"className={`w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-2xl focus:border-blue-600 focus:outline-none transition-all ${\1 === '' ? 'text-gray-400' : 'text-black'}`}",
        content
    )
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {file_path}")
    else:
        print(f"No changes: {file_path}")











