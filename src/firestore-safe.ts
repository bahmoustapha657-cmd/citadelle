import {
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type FirestoreError,
  type Query,
  type QuerySnapshot,
  type SnapshotListenOptions,
  type Unsubscribe,
} from "firebase/firestore";

// Trace le dernier passage offline pour distinguer les permission-denied
// transitoires (token JWT expiré pendant la coupure) des vraies erreurs.
let lastOfflineAt = 0;
if (typeof window !== "undefined") {
  window.addEventListener("offline", () => { lastOfflineAt = Date.now(); });
}

const TRANSIENT_WINDOW_MS = 5000;

export function isTransientFirestoreError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string; name?: string }).code
    ?? (err as { name?: string }).name;
  if (code !== "permission-denied" && code !== "unavailable") return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return Date.now() - lastOfflineAt < TRANSIENT_WINDOW_MS;
}

type SafeOpts = { onError?: (err: FirestoreError) => void };

// Wrapper autour de onSnapshot qui :
// - silence les permission-denied/unavailable transitoires (Firebase auto-retry après refresh token)
// - délègue les vraies erreurs à opts.onError ou les log en console.error
export function safeOnSnapshot<T = DocumentData>(
  ref: DocumentReference<T>,
  onNext: (snap: DocumentSnapshot<T>) => void,
  opts?: SafeOpts,
): Unsubscribe;
export function safeOnSnapshot<T = DocumentData>(
  ref: Query<T>,
  onNext: (snap: QuerySnapshot<T>) => void,
  opts?: SafeOpts,
): Unsubscribe;
export function safeOnSnapshot<T = DocumentData>(
  ref: DocumentReference<T>,
  options: SnapshotListenOptions,
  onNext: (snap: DocumentSnapshot<T>) => void,
  opts?: SafeOpts,
): Unsubscribe;
export function safeOnSnapshot<T = DocumentData>(
  ref: Query<T>,
  options: SnapshotListenOptions,
  onNext: (snap: QuerySnapshot<T>) => void,
  opts?: SafeOpts,
): Unsubscribe;
export function safeOnSnapshot(
  ref: any,
  arg2: any,
  arg3?: any,
  arg4?: any,
): Unsubscribe {
  let options: SnapshotListenOptions | undefined;
  let onNext: (snap: any) => void;
  let opts: SafeOpts;
  if (typeof arg2 === "function") {
    onNext = arg2;
    opts = arg3 ?? {};
  } else {
    options = arg2;
    onNext = arg3;
    opts = arg4 ?? {};
  }
  const errorHandler = (err: FirestoreError) => {
    if (isTransientFirestoreError(err)) return;
    if (opts.onError) {
      opts.onError(err);
    } else {
      console.error("[firestore] snapshot error:", err);
    }
  };
  return options
    ? onSnapshot(ref, options, onNext, errorHandler)
    : onSnapshot(ref, onNext, errorHandler);
}
