import { useEffect, useState } from "react";

const QUERY = "(min-width: 900px)";

// True on desktop-sized screens, kept in sync as the window resizes
export const useWide = () => {
  const [wide, setWide] = useState(() => window.matchMedia?.(QUERY).matches ?? false);
  useEffect(() => {
    const list = window.matchMedia?.(QUERY);
    if (!list) return;
    const onChange = () => setWide(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, []);
  return wide;
};
