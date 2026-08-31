import React, { useEffect, useRef } from "react";

interface LandingViewProps {
  onGetStarted: () => void;
  onOpenTerms?: (tab?: "terms" | "privacy" | "cookies") => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onGetStarted,
  onOpenTerms,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Allow messages from the same origin or iframe
      if (event.data && typeof event.data === "object") {
        if (event.data.type === "NALABIA_GET_STARTED") {
          onGetStarted();
        } else if (event.data.type === "NALABIA_OPEN_TERMS") {
          if (onOpenTerms) {
            onOpenTerms(event.data.tab || "terms");
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onGetStarted, onOpenTerms]);

  return (
    <div className="w-full min-h-screen bg-[#070709] text-white flex flex-col">
      <iframe
        ref={iframeRef}
        src="/landing.html"
        title="NaLábia"
        className="w-full h-screen border-0 block flex-1"
        style={{
          width: "100%",
          height: "100vh",
          minHeight: "100vh",
          border: "none",
          backgroundColor: "#070709",
        }}
        allow="clipboard-write; camera; microphone"
      />
    </div>
  );
};

export default LandingView;
