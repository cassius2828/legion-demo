"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Stethoscope, User } from "lucide-react";

import { Button } from "~/components/ui/button";
import { personProfilePath } from "~/lib/admin-profile";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { roleLabel } from "~/lib/profile";

export type DirectoryKind = "psychiatrist" | "nurse" | "patient";

export type DirectoryPerson = {
  id: string;
  kind: DirectoryKind;
  name: string;
  email: string;
  organization: string | null;
  clinician: string | null;
  note: string | null;
};

export type DirectoryProvider = {
  id: string;
  name: string;
};

function HospitalPlus({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M9 2.5h6a1 1 0 0 1 1 1V8h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H16v4.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V16H3.5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1H8V3.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

const ROLE_ICON = {
  psychiatrist: Stethoscope,
  patient: User,
} as const;

function RoleMark({ kind }: { kind: DirectoryKind }) {
  const Icon = kind === "nurse" ? null : ROLE_ICON[kind];
  return (
    <span
      title={roleLabel(kind)}
      className="bg-muted text-foreground inline-flex size-7 items-center justify-center rounded-full"
    >
      {Icon ? (
        <Icon className="size-4" aria-hidden />
      ) : (
        <HospitalPlus className="size-5" />
      )}
      <span className="sr-only">{roleLabel(kind)}</span>
    </span>
  );
}

const FILTERS: { id: "all" | DirectoryKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "psychiatrist", label: "Psychs" },
  { id: "nurse", label: "Nurses" },
  { id: "patient", label: "Patients" },
];

export function AdminDirectory({
  people,
  providers,
}: {
  people: DirectoryPerson[];
  providers: DirectoryProvider[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const needle = query.trim().toLowerCase();

  const visiblePeople = useMemo(() => {
    return people.filter((person) => {
      if (filter !== "all" && person.kind !== filter) return false;
      if (!needle) return true;
      return [
        person.name,
        person.email,
        person.organization,
        person.clinician,
        person.note,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [people, filter, needle]);

  const visibleProviders = useMemo(() => {
    if (filter === "patient") return [];
    return providers.filter((provider) => {
      const members = people.filter(
        (person) =>
          person.organization === provider.name &&
          (filter === "all" || person.kind === filter),
      );
      if (filter !== "all" && members.length === 0) return false;
      if (!needle) return true;
      if (provider.name.toLowerCase().includes(needle)) return true;
      return members.some((person) =>
        `${person.name} ${person.email}`.toLowerCase().includes(needle),
      );
    });
  }, [providers, people, filter, needle]);

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <label className="grid w-full max-w-md gap-1 text-sm">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, or provider"
            className="bg-background h-9 rounded-lg border px-3"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filter === item.id ? "default" : "outline"}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {visiblePeople.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-sm">
          No matching people.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePeople.map((person) => (
            <li key={person.id}>
              <Link
                href={personProfilePath(person.kind, person.id)}
                className="focus-visible:ring-ring block h-full rounded-xl focus-visible:ring-2 focus-visible:outline-none"
              >
                <Card
                  size="sm"
                  className="hover:border-primary h-full transition-colors"
                >
                  <CardHeader>
                    <CardTitle>{person.name}</CardTitle>
                    <CardAction>
                      <RoleMark kind={person.kind} />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p>{person.email}</p>
                    {person.kind === "patient" ? (
                      <p className="text-muted-foreground">
                        {person.note ?? "No insurance recorded"}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        {person.organization ?? "No provider"}
                      </p>
                    )}
                    {person.clinician ? (
                      <p className="text-muted-foreground">
                        Clinician {person.clinician}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">
                      {roleLabel(person.kind)}
                      {person.kind !== "patient" && person.note
                        ? ` · ${person.note}`
                        : null}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {filter === "patient" ? null : (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Providers</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Organizations psychiatrists and nurses belong to.
          </p>
          {visibleProviders.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">
              No matching providers.
            </p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProviders.map((provider) => {
                const members = people.filter((person) => {
                  if (person.organization !== provider.name) return false;
                  if (filter !== "all" && person.kind !== filter) return false;
                  return true;
                });
                return (
                  <li key={provider.id}>
                    <Card size="sm" className="h-full">
                      <CardHeader>
                        <CardTitle>{provider.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm">
                        {members.length === 0 ? (
                          <p className="text-muted-foreground">
                            No clinicians yet
                          </p>
                        ) : (
                          members.map((member) => (
                            <p
                              key={member.id}
                              className="text-muted-foreground"
                            >
                              {member.name} · {roleLabel(member.kind)}
                            </p>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
