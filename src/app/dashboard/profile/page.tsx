"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/profile");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load profile");
        return;
      }
      setProfile(json);
      setDisplayName(json.display_name ?? "");
    }
    load();
  }, []);

  async function uploadAvatar(file: File) {
    if (!profile) return null;
    const supabase = createClient();
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop() ?? "png";
    const key = `${profile.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("avatars").upload(key, file, {
      upsert: true,
      contentType: file.type,
    });
    setUploading(false);
    if (error) {
      setError(error.message);
      return null;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(key);
    return data.publicUrl;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        avatar_url: profile.avatar_url,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to save profile");
      return;
    }
    setProfile(json);
    setSuccess("Profile updated");
  }

  if (!profile) {
    return (
      <section className="panel">
        <div className="panel-body">Loading profile...</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>PROFILE</h2>
      </div>
      <form className="panel-body" onSubmit={save}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
          <img
            src={profile.avatar_url ?? "/avatar-placeholder.svg"}
            alt="Profile avatar"
            className="avatar-lg"
          />
          <div>
            <p className="muted" style={{ marginTop: 0 }}>
              {profile.email}
            </p>
            <label className="btn btn-ghost" style={{ display: "inline-block" }}>
              {uploading ? "Uploading..." : "Upload Profile Picture"}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadAvatar(file);
                  if (url) {
                    setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev));
                    const saveRes = await fetch("/api/profile", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        avatar_url: url,
                      }),
                    });
                    if (!saveRes.ok) {
                      const saveJson = await saveRes.json();
                      setError(saveJson.error ?? "Failed to persist avatar");
                    } else {
                      setSuccess("Profile picture saved");
                    }
                  }
                }}
              />
            </label>
          </div>
        </div>

        <div className="form-row">
          <label>Username (combatant name)</label>
          <input
            className="input"
            maxLength={24}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter username"
            required
          />
        </div>

        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
        {success ? <p style={{ color: "var(--primary)" }}>{success}</p> : null}

        <button className="btn btn-primary" type="submit" disabled={saving || uploading}>
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </section>
  );
}
