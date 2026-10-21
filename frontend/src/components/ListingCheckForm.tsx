"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ListingCheckResult } from "@/components/ListingCheckResult";
import { Spinner } from "@/components/Spinner";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useDict, useLocale } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { prepareImage, type ListingImage } from "@/lib/listingImage";
import type { ListingCheck, ListingCheckCreated, ListingCheckLimits, University } from "@/types";

const SIGNUP = "/signup?next=/assistant";
// 409 = this listing (same key) is still being answered by an earlier request,
// e.g. after a network retry: wait for that answer rather than spend another check.
// Polls for 5½ minutes: longer than the backend's STALE_PENDING (5 min), after
// which it frees a dead request's row and this retry gets answered itself.
const PENDING_RETRY_MS = 3000;
const PENDING_MAX_TRIES = 110;

export function ListingCheckForm({
  universities,
  limits,
  remaining: initialRemaining,
}: {
  universities: University[];
  limits: ListingCheckLimits;
  remaining: number;
}) {
  const { checks_per_account: limit, max_images: maxImages } = limits;
  const dict = useDict();
  const d = dict.assistant;
  const locale = useLocale();
  const router = useRouter();
  const [uniSlug, setUniSlug] = useState<string | null>(null);
  const [deptId, setDeptId] = useState("");
  const uni = universities.find((u) => u.slug === uniSlug) ?? null;
  const [text, setText] = useState("");
  const [images, setImages] = useState<{ name: string; image: ListingImage }[]>([]);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<ListingCheck | null>(null);
  // One key per submitted listing: a double-click or retry spends a single check.
  const submitKey = useRef<string | null>(null);

  async function addImages(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = maxImages - images.length;
    if (files.length > room) setError(fmt(d.tooManyImages, { max: maxImages }));
    setPreparing(true); // hides the picker, so a second batch can't race this one
    try {
      const added = await Promise.all(
        Array.from(files)
          .slice(0, room)
          .map(async (f) => ({ name: f.name, image: await prepareImage(f) })),
      );
      setImages((prev) => [...prev, ...added].slice(0, maxImages));
      submitKey.current = null;
    } catch {
      setError(d.imageError);
    } finally {
      setPreparing(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || remaining <= 0) return;
    if (!text.trim() && !images.length) {
      setError(d.needInput);
      return;
    }
    setLoading(true);
    setError(null);
    const key = (submitKey.current ??= crypto.randomUUID());
    const body = JSON.stringify({
      department_id: deptId || null,
      text: text.trim() || null,
      images: images.map((i) => i.image),
    });
    const post = () =>
      apiFetch<ListingCheckCreated>(`/assistant/listing-checks?lang=${locale}`, {
        method: "POST",
        body,
        headers: { "Idempotency-Key": key },
      });
    try {
      let result: ListingCheckCreated | null = null;
      for (let tries = 0; !result; tries++) {
        try {
          result = await post();
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 409) || tries >= PENDING_MAX_TRIES) throw err;
          await new Promise((r) => setTimeout(r, PENDING_RETRY_MS));
        }
      }
      setCheck(result);
      setRemaining(result.remaining); // the server's count: a replayed key spends nothing
      setText("");
      setImages([]);
      submitKey.current = null;
      router.refresh(); // updates the history list below
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(SIGNUP);
      } else if (err instanceof ApiError && err.status === 402) {
        // Possibly a request from another tab took the last check: the refresh
        // shows its answer in the history list once it's stored.
        setRemaining(0);
        router.refresh();
      } else {
        // Retrying can't fix a rejected screenshot or a department that's gone.
        const status = err instanceof ApiError ? err.status : 0;
        setError(
          status === 503
            ? d.unavailable
            : status === 422 && images.length
              ? d.imageError
              : status === 404
                ? d.badDepartment
                : d.error,
        );
      }
    } finally {
      setLoading(false);
    }
  }

  const none = remaining <= 0;

  return (
    <div className="space-y-6">
      <p className={`text-sm font-medium ${none ? "text-danger" : "text-muted"}`}>
        {none ? fmt(d.noneLeft, { limit }) : remaining === 1 ? d.remainingOne : fmt(d.remaining, { remaining })}
      </p>

      {!none && (
        <form onSubmit={submit} className="space-y-5">
          {/* Same picker as /match: university first, then its departments. Optional. */}
          <fieldset className="space-y-2">
            <legend className="font-medium">{d.university}</legend>
            <p className="text-sm text-muted">{d.universityHint}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {universities.map((u) => (
                <button
                  key={u.slug}
                  type="button"
                  aria-pressed={u.slug === uniSlug}
                  onClick={() => {
                    // Tapping the chosen one again clears it ("not sure yet").
                    setUniSlug(u.slug === uniSlug ? null : u.slug);
                    setDeptId("");
                    submitKey.current = null;
                  }}
                  className={`rounded-lg border p-2.5 text-left text-sm transition ${
                    u.slug === uniSlug
                      ? "border-brand bg-brand-light ring-2 ring-brand/30"
                      : "border-border hover:border-brand"
                  }`}
                >
                  <div className="font-semibold">{u.short_name}</div>
                </button>
              ))}
            </div>
          </fieldset>

          {uni && (
            <label className="block space-y-2">
              <span className="font-medium">{dict.match.department}</span>
              <select
                value={deptId}
                onChange={(e) => {
                  setDeptId(e.target.value);
                  submitKey.current = null;
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">{dict.match.chooseDepartment}</option>
                {uni.campuses.map((c) => (
                  <optgroup key={c.slug} label={c.name}>
                    {uni.departments
                      .filter((dep) => dep.campus_slug === c.slug)
                      .map((dep) => (
                        <option key={dep.id} value={dep.id}>
                          {dep.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-2">
            <span className="font-medium">{d.text}</span>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                submitKey.current = null;
              }}
              maxLength={limits.max_text_chars}
              rows={6}
              placeholder={d.textPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <div className="space-y-2">
            <span className="block font-medium">{fmt(d.images, { max: maxImages })}</span>
            {images.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <li key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data: preview */}
                    <img
                      src={`data:${img.image.media_type};base64,${img.image.data_base64}`}
                      alt={img.name}
                      className="h-24 w-24 rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      aria-label={fmt(d.removeImage, { n: i + 1 })}
                      onClick={() => {
                        setImages((prev) => prev.filter((_, j) => j !== i));
                        submitKey.current = null;
                      }}
                      className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-foreground text-sm text-background"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {preparing && <Spinner size={24} />}
            {images.length < maxImages && !preparing && (
              <label className="inline-block cursor-pointer rounded-lg border border-dashed border-border px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand">
                {d.addImages}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void addImages(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {loading && <Spinner size={18} className="text-white" decorative />}
              {loading ? d.checking : d.submit}
            </button>
            <span className="text-sm text-muted">{d.usesOne}</span>
          </div>
        </form>
      )}

      {check && <ListingCheckResult result={check.result} lang={check.lang} />}
    </div>
  );
}
