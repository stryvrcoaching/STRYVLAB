# Guide de Développement STRYVR Mobile

## Vue d'ensemble

STRYVR est une application mobile React Native/Expo pour le suivi sportif et nutritionnel personnalisé avec calculs moteurs intégrés.

## Architecture Technique

### Stack
- **Expo SDK 52+**: Framework React Native avec builds natifs
- **Expo Router v4**: Navigation file-based
- **Supabase**: Backend PostgreSQL + Auth + Storage
- **TanStack Query**: State management serveur
- **MMKV**: Stockage local rapide
- **TypeScript**: Typage strict

### Structure des Dossiers

```
stryvr/
├── app/                 # Routes Expo Router (file-based)
├── components/ui/       # Composants UI de base
├── constants/          # Constantes design + scientifiques
├── lib/                # Services, hooks, queries
├── types/              # Interfaces TypeScript
└── assets/             # Images et ressources
```

## Démarrage Rapide

### Installation
```bash
cd stryvr
npm install
cp .env.example .env  # Configurer les variables
npx expo start
```

### Variables d'Environnement
```env
EXPO_PUBLIC_SUPABASE_URL=your_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
```

## Patterns de Développement

### Composants UI
```tsx
// components/ui/Button.tsx
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ ... }) => {
  // Implémentation avec styles DS
};
```

### Queries Supabase
```tsx
// lib/queries/useMotorState.ts
export const useMotorState = (userId: string) => {
  return useQuery({
    queryKey: ['motorState', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('motor_states')
        .select('*')
        .eq('user_id', userId)
        .single();
      return data;
    },
  });
};
```

### Authentification
```tsx
// lib/hooks/useAuth.ts
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
  }, []);

  return { user, isAuthenticated: !!user };
};
```

## Design System

### Couleurs
```tsx
const COLORS = {
  background: '#121212',
  surface: '#181818',    // Modals uniquement
  primary: '#1f8a65',
  white: '#FFFFFF',
  muted: '#FFFFFF/60',
};
```

### Espacement
```tsx
const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
```

## API Supabase

### Tables Principales
- `users`: Utilisateurs authentifiés
- `motor_states`: États moteurs quotidiens
- `phases`: Phases d'entraînement
- `training_sessions`: Séances
- `nutrition_entries`: Apports nutritionnels

### RLS Policies
Toutes les tables utilisent Row Level Security avec filtrage par `user_id`.

## Build & Déploiement

### Développement
```bash
npm start              # Expo dev server
npm run ios           # Simulator iOS
npm run android       # Emulator Android
```

### Production
```bash
eas build --platform ios     # Build iOS
eas build --platform android # Build Android
eas submit --platform ios    # Submit App Store
```

## Debugging

### Logs
```tsx
import { logger } from '../lib/logger';

logger.info('User action', { userId, action: 'login' });
```

### Erreurs
```tsx
try {
  await apiCall();
} catch (error) {
  Alert.alert('Erreur', error.message);
}
```

## Tests

### Unit Tests
```bash
npm run test
```

### Structure des Tests
```
__tests__/
├── components/
├── lib/
└── utils/
```

## Performance

### Optimisations
- Queries avec `staleTime` de 5 minutes
- Images optimisées automatiquement
- Bundle splitting avec Expo Router

### Métriques
- Bundle size < 10MB
- Cold start < 3s
- API response < 300ms

## Sécurité

### Authentification
- Supabase Auth avec sessions persistantes
- Refresh tokens automatique
- Routes protégées côté client

### Données
- RLS activé sur toutes les tables
- Encryption des données sensibles
- Validation côté client + serveur

## Contribution

### Commits
```
feat: add user authentication
fix: resolve login timeout
docs: update API documentation
```

### Code Style
- ESLint + Prettier configurés
- TypeScript strict mode
- Imports organisés (React, puis externes, puis internes)

## Ressources

- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [React Query](https://tanstack.com/query)
- [Design System](./constants/theme.ts)