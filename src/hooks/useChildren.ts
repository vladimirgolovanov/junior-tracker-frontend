import { useEffect } from "react";
import { useAuthStore } from "../store/auth";
import { useChildrenStore } from "../store/children";

export default function useChildren() {
  const token = useAuthStore((s) => s.token);
  const children = useChildrenStore((s) => s.children);
  const load = useChildrenStore((s) => s.load);

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  return children;
}
