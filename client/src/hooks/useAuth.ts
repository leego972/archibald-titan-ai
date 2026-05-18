/**
   * @deprecated This file is a legacy stub and should NOT be imported directly.
   *
   * The canonical auth hook is at `@/_core/hooks/useAuth` which uses the
   * server-side tRPC session. This file previously contained an insecure
   * localStorage-based implementation that stored password hashes client-side
   * using a non-cryptographic hash function.
   *
   * Import from: import { useAuth } from "@/_core/hooks/useAuth";
   */
  export { useAuth } from "@/_core/hooks/useAuth";
  