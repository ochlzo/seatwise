'use client';

type QueueStatusProps = {
  state: "idle" | "waiting" | "active";
  position?: number;
  etaMs?: number;
  msLeft?: number;
  liveCount?: number;
};

function formatDuration(ms?: number) {
  if (ms == null) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function QueueStatus({
  state,
  position,
  etaMs,
  msLeft,
  liveCount,
}: QueueStatusProps) {
  const viewerText = `${liveCount ?? 0} people viewing this page`;

  if (state === "waiting") {
    return (
      <div className="space-y-4 rounded-lg border border-dashed border-yellow-400 bg-yellow-50 p-6 text-yellow-950">
        <p className="text-lg font-medium">
          {"Looks like someone is reserving their seat. Please wait in line \u2014 you\u2019re at #"}
          {position ?? 1}
          {" in line."}
        </p>
        <p className="text-sm text-yellow-900">
          Estimated wait: <span className="font-semibold">{formatDuration(etaMs)}</span>
        </p>
        <p className="text-sm text-yellow-900">{viewerText}</p>
      </div>
    );
  }

  if (state === "active") {
    return (
      <div className="space-y-3 rounded-lg border border-green-500 bg-green-50 p-6 text-green-950">
        <p className="text-lg font-semibold">
          {"It's your turn \u2014 you have the page."}
        </p>
        <p className="text-sm">
          Hold time remaining: <span className="font-semibold">{formatDuration(msLeft)}</span>
        </p>
        <p className="text-sm text-green-900">{viewerText}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
      <p className="font-medium text-gray-700">Queue idle</p>
      <p className="text-gray-500">{viewerText}</p>
    </div>
  );
}
