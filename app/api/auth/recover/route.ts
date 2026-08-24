import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function hashPhrase(phrase: string) {
  return crypto
    .createHash("sha256")
    .update(phrase.trim())
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = String(body.phone || "").trim();
    const recoveryPhrase = String(body.recoveryPhrase || "").trim();
    const newPassword = String(body.newPassword || "");

    if (!phone || !recoveryPhrase || !newPassword) {
      return NextResponse.json(
        { error: "اطلاعات ناقص است." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "رمز عبور باید حداقل ۶ کاراکتر باشد." },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, "");

    // Find profile by phone-based username
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, username, recovery_phrase_hash")
      .eq("username", normalizedPhone)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      return NextResponse.json(
        { error: "خطا در بررسی حساب." },
        { status: 500 }
      );
    }

    if (!profile || !profile.recovery_phrase_hash) {
      return NextResponse.json(
        { error: "شماره تماس یا عبارت بازیابی صحیح نیست." },
        { status: 400 }
      );
    }

    // Compare recovery phrase hash
    const suppliedHash = hashPhrase(recoveryPhrase);

    if (suppliedHash !== profile.recovery_phrase_hash) {
      return NextResponse.json(
        { error: "شماره تماس یا عبارت بازیابی صحیح نیست." },
        { status: 400 }
      );
    }

    // Change password using Supabase Admin API
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(profile.id, {
        password: newPassword,
      });

    if (updateError) {
      console.error(updateError);
      return NextResponse.json(
        { error: "تغییر رمز عبور انجام نشد." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "رمز عبور با موفقیت تغییر کرد.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "خطای غیرمنتظره رخ داد." },
      { status: 500 }
    );
  }
}