"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import type { Skill } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ALL = "Todos";

export function SkillsExplorer({ skills }: { skills: Skill[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);

  const categories = useMemo(
    () => [ALL, ...new Set(skills.map((s) => s.category))],
    [skills],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>([[ALL, skills.length]]);
    for (const s of skills) map.set(s.category, (map.get(s.category) ?? 0) + 1);
    return map;
  }, [skills]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter(
      (s) =>
        (category === ALL || s.category === category) &&
        (!q ||
          [s.name, s.description, s.use_case ?? "", s.category].some((f) =>
            f.toLowerCase().includes(q),
          )),
    );
  }, [skills, query, category]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, descrição ou caso de uso…"
          className="pl-9"
          aria-label="Buscar skills"
        />
      </div>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="h-auto flex-wrap justify-start">
          {categories.map((c) => (
            <TabsTrigger key={c} value={c}>
              {c}
              <span className="text-muted-foreground ml-1 text-xs">
                {counts.get(c)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <p className="text-muted-foreground text-sm">
        {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          Nenhuma skill encontrada.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <CardHeader className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="font-mono text-base">{s.name}</CardTitle>
                  <Badge variant={s.kind === "skill" ? "secondary" : "outline"}>
                    {s.category}
                  </Badge>
                </div>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardFooter className="flex items-center justify-between gap-2 text-sm">
                {s.use_case && (
                  <span className="text-muted-foreground">{s.use_case}</span>
                )}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex shrink-0 items-center gap-1 hover:underline"
                  >
                    Abrir <ExternalLink className="size-3.5" />
                  </a>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
