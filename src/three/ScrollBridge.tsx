import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import { progressStore } from "../ui/progressStore";

// Pushes the current scroll offset into the external store each frame.
export function ScrollBridge() {
  const scroll = useScroll();
  useFrame(() => progressStore.set(scroll.offset));
  return null;
}
