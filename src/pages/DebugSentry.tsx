import { ToolLayout } from "@/components/tool/ToolLayout";
import { Button } from "@/components/ui/button-brutal";
import * as Sentry from "@sentry/react";

function ErrorButton() {
  return (
    <Button
      onClick={() => {
        throw new Error("This is your first error!");
      }}
    >
      Break the world
    </Button>
  );
}

function CaptureButton() {
  return (
    <Button
      variant="outline"
      onClick={() => {
        Sentry.captureException(new Error("Sentry captureException test"));
      }}
    >
      Send to Sentry (captureException)
    </Button>
  );
}

const DebugSentry = () => {
  return (
    <ToolLayout title="Sentry Debug" description="Use this page to verify Sentry error tracking">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="border-4 border-black bg-card p-6 shadow-brutal">
          <p className="font-medium mb-4">Use either button to verify capture. If ads/tracking blockers are enabled, try the manual capture or disable the blocker.</p>
          <div className="flex gap-3">
            <ErrorButton />
            <CaptureButton />
          </div>
        </div>
        <div className="border-4 border-black bg-muted p-4 text-sm">
          <div className="font-bold mb-1">Environment</div>
          <div>DSN set: {import.meta.env.VITE_SENTRY_DSN ? "yes" : "no"}</div>
          <div>Mode: {import.meta.env.MODE}</div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default DebugSentry;
