import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth";

interface Child {
  id: number;
  name: string;
  timezone?: string;
}

export default function useChildren() {
  const [children, setChildren] = useState<Child[]>([]);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    fetch("/api/children/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setChildren(data);
      })
      .catch(() => {});
  }, [token]);

  return children;
}
