import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function normalizePhone(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\D/g, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(String(body.phone || ""));

    if (!/^09\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "شماره موبایل صحیح نیست." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .eq("username", phone)
      .maybeSingle();

    if (profileError) {
      console.error("Login profile lookup error:", profileError);
      return NextResponse.json(
        { error: "خطا در بررسی حساب. دوباره تلاش کنید." },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "حسابی با این شماره موبایل پیدا نشد." },
        { status: 404 }
      );
    }

    // Resolve the real Auth email from the user's Auth record.
    // This keeps all previously created accounts working even if their
    // internal email was created with a different provider/domain.
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (authError || !authUser.user?.email) {
      console.error("Login auth-user lookup error:", authError);
      return NextResponse.json(
        { error: "حساب کاربری پیدا شد اما اطلاعات ورود آن ناقص است." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, email: authUser.user.email });
  } catch (error) {
    console.error("Unexpected login resolve error:", error);
    return NextResponse.json(
      { error: "خطای غیرمنتظره در ورود." },
      { status: 500 }
    );
  }
}
