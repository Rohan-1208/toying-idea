 import { useEffect } from "react";
import { Experience } from "../three/Experience";
import { Chrome } from "../ui/Chrome";
import { Loader } from "../ui/Loader";
import { CartDrawer } from "../components/CartDrawer";

export default function Home() {
  // Lock body scroll while the 3D scene (with its own scroll container) is mounted.
  useEffect(() => {
    document.documentElement.classList.add("lock-scroll");
    return () => document.documentElement.classList.remove("lock-scroll");
  }, []);

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-cream">
      <Experience />
      <Chrome />
      <Loader />
      <CartDrawer />
    </div>
  );
}
