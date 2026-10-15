"use client";

import { useActionState, useState } from "react";

import { Button } from "~/components/ui/button";
import { ROLES, type Role } from "~/lib/profile";

const inputClass = "h-9 rounded-lg border bg-background px-3";

export function ProfileForm({
  action,
  mode,
  defaults,
  organizations,
}: {
  action: (state: { error: string } | null, formData: FormData) => Promise<{ error: string } | null>;
  mode: "signup" | "edit";
  organizations: string[];
  defaults: {
    name: string;
    email: string;
    role: Role | null;
    primaryInsurance: string;
    secondaryInsurance: string;
    organization: string;
  };
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [role, setRole] = useState<Role | "">(defaults.role ?? "");
  const knownOrganization = organizations.find((item) => item === defaults.organization);
  const [organizationChoice, setOrganizationChoice] = useState(
    knownOrganization ?? (defaults.organization ? "other" : ""),
  );

  return (
    <form action={formAction} className="grid gap-4">
      <label className="grid gap-1 text-sm">
        Name
        <input name="name" required defaultValue={defaults.name} maxLength={120} className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          defaultValue={defaults.email}
          maxLength={200}
          className={inputClass}
        />
      </label>

      {mode === "signup" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm">Role</legend>
          {ROLES.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 has-checked:border-primary has-checked:bg-accent"
            >
              <input
                type="radio"
                name="role"
                value={item.id}
                required
                checked={role === item.id}
                onChange={() => setRole(item.id)}
                className="size-4 accent-primary"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {role === "patient" ? (
        <>
          <label className="grid gap-1 text-sm">
            Primary insurance
            <input
              name="primaryInsurance"
              required
              defaultValue={defaults.primaryInsurance}
              maxLength={120}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Secondary insurance
            <input
              name="secondaryInsurance"
              defaultValue={defaults.secondaryInsurance}
              maxLength={120}
              className={inputClass}
            />
          </label>
        </>
      ) : null}

      {role === "psychiatrist" || role === "nurse" ? (
        <>
          <label className="grid gap-1 text-sm">
            Provider
            <select
              name="organizationChoice"
              required
              value={organizationChoice}
              onChange={(event) => setOrganizationChoice(event.target.value)}
              className={inputClass}
            >
              <option value="">Select a provider</option>
              {organizations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
          </label>
          {organizationChoice === "other" ? (
            <label className="grid gap-1 text-sm">
              Provider name
              <input
                name="organizationOther"
                required
                defaultValue={knownOrganization ? "" : defaults.organization}
                maxLength={120}
                className={inputClass}
              />
            </label>
          ) : null}
        </>
      ) : null}

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {mode === "signup" ? "Continue" : "Save"}
      </Button>
    </form>
  );
}
