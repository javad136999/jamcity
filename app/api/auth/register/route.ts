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

    const displayName = String(body.displayName || "").trim();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const recoveryPhrase = String(body.recoveryPhrase || "").trim();

    const normalizedPhone = phone.replace(/\D/g, "");

    // بررسی نام نمایشی
    if (displayName.length < 2) {
      return NextResponse.json(
        { error: "نام نمایشی باید حداقل ۲ کاراکتر باشد." },
        { status: 400 }
      );
    }

    if (displayName.length > 50) {
      return NextResponse.json(
        { error: "نام نمایشی نمی‌تواند بیشتر از ۵۰ کاراکتر باشد." },
        { status: 400 }
      );
    }

    // بررسی شماره موبایل
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      return NextResponse.json(
        { error: "شماره موبایل صحیح نیست." },
        { status: 400 }
      );
    }

    // بررسی رمز عبور
    if (password.length < 6) {
      return NextResponse.json(
        { error: "رمز عبور باید حداقل ۶ کاراکتر باشد." },
        { status: 400 }
      );
    }

    // بررسی عبارت بازیابی
    if (recoveryPhrase.length < 6) {
      return NextResponse.json(
        { error: "عبارت بازیابی باید حداقل ۶ کاراکتر باشد." },
        { status: 400 }
      );
    }

    // ایمیل داخلی برای سیستم احراز هویت Supabase
    const email = `${normalizedPhone}@wall.jamcity.local`;

    // بررسی اینکه شماره قبلاً ثبت نشده باشد
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

    // ساخت حساب در Supabase Auth
    const { data: userData, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username: normalizedPhone,
          display_name: displayName,
          account_source: "phone",
        },
      });

    if (createUserError || !userData.user) {
      console.error(createUserError);

      return NextResponse.json(
        {
          error:
            createUserError?.message || "ساخت حساب انجام نشد.",
        },
        { status: 400 }
      );
    }

    const userId = userData.user.id;

    // ذخیره اطلاعات پروفایل
    // عبارت بازیابی فقط به صورت Hash ذخیره می‌شود
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        username: normalizedPhone,
        display_name: displayName,
        recovery_phrase_hash: hashPhrase(recoveryPhrase),
        onboarded: true,
      })
      .eq("id", userId);

    if (profileError) {
      console.error(profileError);

      // اگر ساخت پروفایل شکست خورد، حساب Auth هم حذف شود
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