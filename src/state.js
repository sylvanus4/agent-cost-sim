// URL-as-state: serialize the pipeline config into the URL so a scenario is
// shareable and reproducible. Compact base64url of a small JSON payload.

function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(token) {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeState(state) {
  const json = JSON.stringify(state);
  return bytesToB64url(new TextEncoder().encode(json));
}

export function decodeState(token) {
  if (!token) return null;
  try {
    const json = new TextDecoder().decode(b64urlToBytes(token));
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return decodeState(params.get("c"));
}

export function writeStateToUrl(state) {
  const token = encodeState(state);
  const url = new URL(window.location.href);
  url.searchParams.set("c", token);
  window.history.replaceState(null, "", url);
  return url.href;
}
