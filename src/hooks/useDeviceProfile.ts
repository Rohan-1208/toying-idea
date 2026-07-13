import { useEffect, useState } from "react";

export type DeviceProfile = {
  mobile: boolean;
  touch: boolean;
  reducedMotion: boolean;
};

const DEFAULT: DeviceProfile = { mobile: false, touch: false, reducedMotion: false };

export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(() => {
    if (typeof window === "undefined") return DEFAULT;
    return {
      mobile: window.matchMedia("(max-width: 768px)").matches,
      touch: window.matchMedia("(hover: none)").matches,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  });

  useEffect(() => {
    const mobileMq = window.matchMedia("(max-width: 768px)");
    const touchMq = window.matchMedia("(hover: none)");
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () =>
      setProfile({
        mobile: mobileMq.matches,
        touch: touchMq.matches,
        reducedMotion: motionMq.matches,
      });

    update();
    mobileMq.addEventListener("change", update);
    touchMq.addEventListener("change", update);
    motionMq.addEventListener("change", update);
    return () => {
      mobileMq.removeEventListener("change", update);
      touchMq.removeEventListener("change", update);
      motionMq.removeEventListener("change", update);
    };
  }, []);

  return profile;
}
