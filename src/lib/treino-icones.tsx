import {
  Activity, Bike, Dumbbell, Flame, HeartPulse, Leaf, Music, PersonStanding, Sparkles, Timer,
  Trophy, Users, Waves, Zap, type LucideIcon, type LucideProps,
} from "lucide-react";

// Chaves iguais ao CHECK de public.treinos.icone (migration 0006).
export const TREINO_ICONES = {
  dumbbell: { label: "Halter", Icon: Dumbbell },
  activity: { label: "Pulso", Icon: Activity },
  "person-standing": { label: "Pessoa", Icon: PersonStanding },
  users: { label: "Grupo", Icon: Users },
  "heart-pulse": { label: "Coração", Icon: HeartPulse },
  flame: { label: "Chama", Icon: Flame },
  timer: { label: "Cronômetro", Icon: Timer },
  sparkles: { label: "Brilho", Icon: Sparkles },
  leaf: { label: "Folha", Icon: Leaf },
  zap: { label: "Raio", Icon: Zap },
  trophy: { label: "Troféu", Icon: Trophy },
  music: { label: "Música", Icon: Music },
  bike: { label: "Bicicleta", Icon: Bike },
  waves: { label: "Ondas", Icon: Waves },
} satisfies Record<string, { label: string; Icon: LucideIcon }>;

export type TreinoIcone = keyof typeof TREINO_ICONES;

export const ICONE_OPTIONS = (Object.keys(TREINO_ICONES) as TreinoIcone[]).map((value) => ({
  value,
  label: TREINO_ICONES[value].label,
}));

// Ícone pela chave do banco; chave desconhecida cai no halter.
export function TreinoIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = (TREINO_ICONES as Record<string, { Icon: LucideIcon }>)[name]?.Icon ?? Dumbbell;
  return <Icon {...props} />;
}
