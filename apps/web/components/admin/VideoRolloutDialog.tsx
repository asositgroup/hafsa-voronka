"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ROLLOUT_AUDIENCES,
  ROLLOUT_SINCE_DAYS_MAX,
  ROLLOUT_WINDOW,
  type RolloutAudience,
  type VideoRollout,
  rolloutAudiences,
  validateRolloutSchedule,
} from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { DatePicker } from "@/components/admin/ui/DatePicker";
import { Sheet } from "@/components/admin/ui/Dialog";
import { Field, Input } from "@/components/admin/ui/Field";
import { Notice } from "@/components/admin/ui/Notice";
import { Segmented } from "@/components/admin/ui/Segmented";
import { Switch } from "@/components/admin/ui/Switch";
import { TimePicker } from "@/components/admin/ui/TimePicker";
import { addDays, getTashkentToday } from "@/lib/admin/dates";
import { formatCount, rolloutFailureMessage, tashkentToIso } from "@/lib/admin/rollouts";
import { createRollout, previewRollout } from "@/lib/admin/videos";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos.rollout;

const PREVIEW_DEBOUNCE_MS = 300;
const DEFAULT_SINCE_DAYS = "90";
const DEFAULT_MINUTE = 10 * 60;

type When = "now" | "later";

type PreviewState = { key: string; count: number | null };

const outsideWindow = (minuteOfDay: number) => minuteOfDay < ROLLOUT_WINDOW.start || minuteOfDay > ROLLOUT_WINDOW.end;

type VideoRolloutDialogProps = {
  videoId: number;
  onCreated: (rollout: VideoRollout) => void;
  onClose: () => void;
};

export function VideoRolloutDialog({ videoId, onCreated, onClose }: VideoRolloutDialogProps) {
  const [audiences, setAudiences] = useState<readonly RolloutAudience[]>(DEFAULT_ROLLOUT_AUDIENCES);
  const [limitSince, setLimitSince] = useState(false);
  const [sinceText, setSinceText] = useState(DEFAULT_SINCE_DAYS);
  const [when, setWhen] = useState<When>("now");
  const [date, setDate] = useState(() => addDays(getTashkentToday(), 1));
  const [minute, setMinute] = useState(DEFAULT_MINUTE);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sinceNumber = Number(sinceText);
  const sinceValid = Number.isInteger(sinceNumber) && sinceNumber >= 1 && sinceNumber <= ROLLOUT_SINCE_DAYS_MAX;
  const sinceDays = limitSince && sinceValid ? sinceNumber : null;
  const filterReady = audiences.length > 0 && (!limitSince || sinceValid);
  const filterKey = `${audiences.join(",")}|${sinceDays}`;

  useEffect(() => {
    if (!filterReady) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void previewRollout(videoId, { audiences: [...audiences], sinceDays }, controller.signal).then((result) => {
        if (controller.signal.aborted) return;
        setPreview({ key: filterKey, count: result.ok ? result.data : null });
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [videoId, audiences, sinceDays, filterKey, filterReady]);

  const scheduledAt = when === "later" ? tashkentToIso(date, minute) : null;
  const scheduleError = useMemo(() => {
    if (scheduledAt === null) return null;
    return validateRolloutSchedule(new Date(scheduledAt), new Date());
  }, [scheduledAt]);

  const previewLoading = filterReady && preview?.key !== filterKey;
  const previewFailed = filterReady && !previewLoading && preview?.count === null;
  const count = filterReady && !previewLoading ? (preview?.count ?? null) : null;
  const canSubmit = filterReady && count !== null && count > 0 && scheduleError === null && !busy;

  function toggleAudience(audience: RolloutAudience, checked: boolean) {
    setAudiences((current) => (checked ? [...current, audience] : current.filter((item) => item !== audience)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await createRollout(videoId, { audiences: [...audiences], sinceDays, scheduledAt });
    setBusy(false);
    if (!result.ok) {
      setError(rolloutFailureMessage(result.error));
      return;
    }
    onCreated(result.data);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={copy.title}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {adminUz.confirm.cancel}
          </Button>
          <Button disabled={!canSubmit} loading={busy} loadingLabel={copy.submitting} onClick={() => void submit()}>
            {copy.submit}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-medium text-siyoh">{copy.audiencesLabel}</legend>
          {rolloutAudiences.map((audience) => (
            <label key={audience} className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
              <input
                type="checkbox"
                checked={audiences.includes(audience)}
                onChange={(event) => toggleAudience(audience, event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-siyoh"
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm text-siyoh">{copy.audiences[audience].label}</span>
                {"hint" in copy.audiences[audience] && (
                  <span className="text-[13px] text-qalam">{(copy.audiences[audience] as { hint: string }).hint}</span>
                )}
              </span>
            </label>
          ))}
          {audiences.length === 0 && (
            <span role="alert" className="text-[13px] text-anor">
              {copy.audiencesRequired}
            </span>
          )}
        </fieldset>

        <div className="flex flex-col gap-1">
          <Switch checked={limitSince} onChange={setLimitSince} label={copy.sinceToggle} showLabel />
          {limitSince && (
            <Field
              label={copy.sinceDaysLabel}
              hideLabel
              suffix={copy.sinceDaysSuffix}
              error={sinceValid ? null : copy.sinceDaysInvalid.replace("{max}", String(ROLLOUT_SINCE_DAYS_MAX))}
              className="max-w-[200px]"
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  inputMode="numeric"
                  value={sinceText}
                  onChange={(event) => setSinceText(event.target.value.replace(/\D/g, ""))}
                />
              )}
            </Field>
          )}
        </div>

        <div className="flex flex-col gap-1.5 rounded-[12px] bg-varaq px-3.5 py-3" aria-live="polite">
          <p className="m-0 text-[15px] font-semibold tabular-nums text-siyoh">
            {!filterReady
              ? copy.audiencesRequired
              : previewLoading
                ? copy.countLoading
                : previewFailed
                  ? copy.countFailed
                  : count === 0
                    ? copy.countZero
                    : copy.countLabel.replace("{count}", formatCount(count ?? 0))}
          </p>
          <p className="m-0 text-[13px] text-qalam">{copy.countNote}</p>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-siyoh">{copy.whenLabel}</span>
          <Segmented
            label={copy.whenLabel}
            value={when}
            onChange={setWhen}
            fill
            items={[
              { value: "now", label: copy.whenNow },
              { value: "later", label: copy.whenLater },
            ]}
          />
          {when === "now" ? (
            <p className="m-0 text-[13px] text-qalam">{copy.nowHint}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={copy.dateLabel}>
                  {({ id }) => (
                    <DatePicker id={id} value={date} onChange={setDate} invalid={scheduleError === "past"} />
                  )}
                </Field>
                <Field label={copy.timeLabel}>
                  {({ id }) => (
                    <TimePicker
                      id={id}
                      value={minute}
                      onChange={setMinute}
                      isDisabled={outsideWindow}
                      invalid={scheduleError === "outside_window"}
                    />
                  )}
                </Field>
              </div>
              {scheduleError ? (
                <span role="alert" className="text-[13px] text-anor">
                  {copy.scheduleErrors[scheduleError]}
                </span>
              ) : (
                <span className="text-[13px] text-qalam">{copy.windowHint}</span>
              )}
            </div>
          )}
        </div>

        {error && (
          <Notice tone="danger" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        )}
      </div>
    </Sheet>
  );
}
