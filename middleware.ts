import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canonicalCitySlug } from "@/lib/cities";

const PRIVATE_PREFIXES = [
  "/wall",
  "/ad/create",
  "/chat",
  "/profile",
  "/settings",
  "/business/register",
  "/business/manage",
  "/admin",
];

const AUTH_PAGES = ["/login", "/register", "/reset-password"];
const CITY_COOKIE = "jamcity_city_slug";
const CITY_ID_COOKIE = "jamcity_city_id";
const CITY_HEADER = "x-jamcity-city-id";
const RESERVED_ROOTS = new Set([
  "api", "auth", "wall", "ad", "business", "businesses", "map", "login",
  "register", "reset-password", "onboarding", "profile", "settings", "chat",
  "discounts", "events", "news", "admin", "referral",
]);

function setCityCookies(response: NextResponse, city: { id: string; slug: string }) {
  const options = {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  response.cookies.set(CITY_COOKIE, city.slug, options);
  response.cookies.set(CITY_ID_COOKIE, city.id, options);
}

function copyResponseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
}

function cleanRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(CITY_HEADER);
  return headers;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: cleanRequestHeaders(request) } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request: { headers: cleanRequestHeaders(request) } });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  let scopedCity: { id: string; slug: string } | null = null;
  let effectivePath = request.nextUrl.pathname;

  if (segments.length > 0 && !RESERVED_ROOTS.has(segments[0])) {
    const candidateSlug = canonicalCitySlug(segments[0]);
    const savedSlug = request.cookies.get(CITY_COOKIE)?.value;
    const savedCityId = request.cookies.get(CITY_ID_COOKIE)?.value;
    const data = savedCityId && savedSlug === candidateSlug
      ? { id: savedCityId, slug: candidateSlug }
      : (await supabase
          .from("cities")
          .select("id,slug")
          .eq("slug", candidateSlug)
          .eq("is_active", true)
          .maybeSingle()).data;

    if (data) {
      scopedCity = data;
      effectivePath = segments.length > 1 ? `/${segments.slice(1).join("/")}` : "/";
    }
  }

  // Keep existing root-relative links working, while making the active city
  // explicit in the address bar after a user has selected/resolved a city.
  const savedSlug = request.cookies.get(CITY_COOKIE)?.value;
  const savedCityId = request.cookies.get(CITY_ID_COOKIE)?.value;
  const pathIsAuthFlow = ["/login", "/register", "/reset-password"].includes(request.nextUrl.pathname)
    || request.nextUrl.pathname.startsWith("/api/")
    || request.nextUrl.pathname.startsWith("/auth/");
  if (
    !scopedCity && savedSlug && savedCityId &&
    !RESERVED_ROOTS.has(canonicalCitySlug(savedSlug)) &&
    !pathIsAuthFlow
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${canonicalCitySlug(savedSlug)}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
    return NextResponse.redirect(url);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => effectivePath === prefix || effectivePath.startsWith(prefix + "/")
  );
  const isAuthPage = AUTH_PAGES.some((page) => effectivePath === page);

  if (!user && isPrivate) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set("Cache-Control", "no-store");
    copyResponseCookies(response, redirectResponse);
    if (scopedCity) setCityCookies(redirectResponse, scopedCity);
    return redirectResponse;
  }

  if (user && effectivePath !== "/onboarding" && !effectivePath.startsWith("/auth/")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && !profile.onboarded) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      const redirectResponse = NextResponse.redirect(url);
      copyResponseCookies(response, redirectResponse);
      if (scopedCity) setCityCookies(redirectResponse, scopedCity);
      return redirectResponse;
    }
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    copyResponseCookies(response, redirectResponse);
    if (scopedCity) setCityCookies(redirectResponse, scopedCity);
    return redirectResponse;
  }

  if (scopedCity) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = effectivePath;
    const requestHeaders = cleanRequestHeaders(request);
    requestHeaders.set(CITY_HEADER, scopedCity.id);
    const rewritten = NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    });
    copyResponseCookies(response, rewritten);
    setCityCookies(rewritten, scopedCity);
    response = rewritten;
  }

  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)",
  ],
};
