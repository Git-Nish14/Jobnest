/** Allow only local navigation after login, including a plugin consent query. */
export function safeAuthRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  let decoded = value;
  try {
    // Check both encoded and decoded separators before giving the path to the
    // browser/router. Backslashes can be interpreted as slashes by URL parsers.
    for (let i = 0; i < 3; i++) {
      if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return "/dashboard";
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    const url = new URL(value, "https://jobnest.invalid");
    if (url.origin !== "https://jobnest.invalid") return "/dashboard";
    if (["/login", "/signup", "/forgot-password", "/auth/callback"].includes(url.pathname)) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}
