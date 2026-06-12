import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SecurityMarketplacePage() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/marketplace"); }, [setLocation]);
  return null;
}
