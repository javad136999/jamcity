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
    const password = String(body.password || "");
    const recoveryPhrase = String(body.recoveryPhrase || "").trim();

    const normalizedPhone = phone.replace(/\D/g, "");

    if (!/^09\d{9}$/.test(normalizedPhone)) {
      return NextResponse.json(
        { error: "شماره موبایل صحیح نیست." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "رمز عبور باید حداقل ۶ کاراکتر باشد." },
        { status: 400 }
      );
    }

    if (recoveryPhrase.length < 6) {
      return NextResponse.json(
        { error: "عبارت بازیابی باید حداقل ۶ کاراکتر باشد." },
        { status: 400 }
      );
    }

    const email = `${normalizedPhone}@wall.jamcity.local`;

    // Check whether this username already exists
    const { data: existingProfile, error: profileCheckError } =
      await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", normalizedPhone)
        .maybeSingle();

    if (profileCheckError) {
      console.error(profileCheckError);

      return NextResponse.json(
        { error: "خطا در بررسی حساب." },
        { status: 500 }
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        { error: "این شماره موبایل قبلاً ثبت‌نام کرده است." },
        { status: 409 }
      );
    }

    // Create Supabase Auth user
    const { data: userData, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username: normalizedPhone,
          display_name: normalizedPhone,
          account_source: "phone",
        },
      });

    if (createUserError || !userData.user) {
      console.error(createUserError);

      return NextResponse.json(
        { error: createUserError?.message || "ساخت حساب انجام نشد." },
        { status: 400 }
      );
    }

    const userId = userData.user.id;

    // Store only the hash of the recovery phrase
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        username: normalizedPhone,
        display_name: normalizedPhone,
        recovery_phrase_hash: hashPhrase(recoveryPhrase),
        onboarded: true,
      })
      .eq("id", userId);

    if (profileError) {
      console.error(profileError);

      // Roll back Auth user if profile creation/update fails
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: "ساخت پروفایل انجام نشد." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "حساب با موفقیت ساخته شد.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "خطای غیرمنتظره رخ داد." },
      { status: 500 }
    );
  }
}