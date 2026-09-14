
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/Feedback";

type Referrer = {
  id: string;
  display_name: string | null;
  username: string | null;
  referral_code: string | null;
  referral_count: number;
  reward_count: number;
  total_reward: number;
  pending_reward: number;
  paid_reward: number;
};

type Reward = {
  id: string;
  referrer_id: string;
  level: number;
  referral_count: number;
  amount_toman: number;
  status: "pending" | "paid";
  paid_at: string | null;
  created_at: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatToman(value: number) {
  return `${formatNumber(value)} تومان`;
}

function maskPhone(phone: string | null) {
  if (!phone) return "---";

  if (phone.length >= 7) {
    return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
  }

  return phone;
}

export default function ReferralAdminPage() {
  const supabase = createClient() as any;

  const { user, isAdmin, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [selectedReferrer, setSelectedReferrer] =
    useState<Referrer | null>(null);

  const [selectedRewards, setSelectedRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "paid"
  >("all");

  const [message, setMessage] = useState<{
    text: string;
    type: "ok" | "err";
  } | null>(null);

  /*
   * -------------------------------------------------------
   * بارگذاری معرف‌ها
   * -------------------------------------------------------
   *
   * توجه:
   * این نسخه اطلاعات profiles را می‌خواند و تعداد کاربران
   * معرفی‌شده را از روی referred_by محاسبه می‌کند.
   */
  async function loadReferrers() {
    setLoading(true);

    try {
      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("profiles")
        .select(
          "id,display_name,username,referral_code,referred_by"
        );

      if (profilesError) {
        console.error(
          "Failed to load profiles:",
          profilesError.message
        );

        setMessage({
          text: "خطا در دریافت کاربران.",
          type: "err",
        });

        setLoading(false);
        return;
      }

      const {
        data: rewards,
        error: rewardsError,
      } = await supabase
        .from("referral_rewards")
        .select(
          "id,referrer_id,level,referral_count,amount_toman,status,paid_at,created_at"
        )
        .order("created_at", {
          ascending: false,
        });

      if (rewardsError) {
        console.error(
          "Failed to load rewards:",
          rewardsError.message
        );
      }

      const rewardRows = (rewards ?? []) as Reward[];
      const profileRows = profiles ?? [];

      const result: Referrer[] = profileRows
        .map((profile: any) => {
          const referralCount = profileRows.filter(
            (child: any) =>
              child.referred_by === profile.id
          ).length;

          const userRewards = rewardRows.filter(
            (reward) =>
              reward.referrer_id === profile.id
          );

          const totalReward = userRewards.reduce(
            (sum, reward) =>
              sum + reward.amount_toman,
            0
          );

          const pendingReward = userRewards
            .filter(
              (reward) => reward.status === "pending"
            )
            .reduce(
              (sum, reward) =>
                sum + reward.amount_toman,
              0
            );

          const paidReward = userRewards
            .filter(
              (reward) => reward.status === "paid"
            )
            .reduce(
              (sum, reward) =>
                sum + reward.amount_toman,
              0
            );

          return {
            id: profile.id,
            display_name: profile.display_name,
            username: profile.username,
            referral_code: profile.referral_code,
            referral_count: referralCount,
            reward_count: userRewards.length,
            total_reward: totalReward,
            pending_reward: pendingReward,
            paid_reward: paidReward,
          };
        })
        .filter(
  (item: Referrer) =>
    item.referral_count > 0 ||
    item.reward_count > 0
)
     .sort(
  (a: Referrer, b: Referrer) =>
    b.referral_count -
    a.referral_count
);   
      setReferrers(result);

      /*
       * اگر معرف انتخاب شده قبلاً وجود داشته،
       * اطلاعات آن را به‌روز می‌کنیم.
       */
      if (selectedReferrer) {
        const updated = result.find(
          (item) =>
            item.id === selectedReferrer.id
        );

        if (updated) {
          setSelectedReferrer(updated);
        }
      }
    } catch (error) {
      console.error(
        "Referral admin error:",
        error
      );

      setMessage({
        text: "خطایی در دریافت اطلاعات رخ داد.",
        type: "err",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;

    loadReferrers();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  /*
   * -------------------------------------------------------
   * نمایش پاداش‌های یک معرف
   * -------------------------------------------------------
   */
  async function openReferrer(referrer: Referrer) {
    setSelectedReferrer(referrer);
    setSelectedRewards([]);
    setRewardsLoading(true);

    const {
      data,
      error,
    } = await supabase
      .from("referral_rewards")
      .select(
        "id,referrer_id,level,referral_count,amount_toman,status,paid_at,created_at"
      )
      .eq("referrer_id", referrer.id)
      .order("level", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Failed to load rewards:",
        error.message
      );

      setMessage({
        text: "خطا در دریافت پاداش‌های این کاربر.",
        type: "err",
      });
    } else {
      setSelectedRewards(
        (data ?? []) as Reward[]
      );
    }

    setRewardsLoading(false);
  }

  /*
   * -------------------------------------------------------
   * تغییر وضعیت پرداخت
   * -------------------------------------------------------
   */
  async function toggleRewardStatus(
    reward: Reward
  ) {
    if (actionLoading) return;

    setActionLoading(reward.id);
    setMessage(null);

    const newStatus =
      reward.status === "paid"
        ? "pending"
        : "paid";

    const newPaidAt =
      newStatus === "paid"
        ? new Date().toISOString()
        : null;

    const {
      error,
    } = await supabase
      .from("referral_rewards")
      .update({
        status: newStatus,
        paid_at: newPaidAt,
      })
      .eq("id", reward.id);

    if (error) {
      console.error(
        "Failed to update reward:",
        error.message
      );

      setMessage({
        text: "تغییر وضعیت پرداخت انجام نشد.",
        type: "err",
      });

      setActionLoading(null);
      return;
    }

    setSelectedRewards((prev) =>
      prev.map((item) =>
        item.id === reward.id
          ? {
              ...item,
              status: newStatus,
              paid_at: newPaidAt,
            }
          : item
      )
    );

    setMessage({
      text:
        newStatus === "paid"
          ? "پاداش به عنوان پرداخت‌شده ثبت شد ✅"
          : "وضعیت پاداش به در انتظار پرداخت تغییر کرد.",
      type: "ok",
    });

    await loadReferrers();

    setActionLoading(null);
  }

  /*
   * -------------------------------------------------------
   * فیلتر
   * -------------------------------------------------------
   */
  const filteredReferrers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return referrers.filter((referrer) => {
      const matchesSearch =
        !query ||
        (referrer.display_name ?? "")
          .toLowerCase()
          .includes(query) ||
        (referrer.username ?? "")
          .toLowerCase()
          .includes(query) ||
        (referrer.referral_code ?? "")
          .toLowerCase()
          .includes(query);

      let matchesStatus = true;

      if (statusFilter === "pending") {
        matchesStatus =
          referrer.pending_reward > 0;
      }

      if (statusFilter === "paid") {
        matchesStatus =
          referrer.paid_reward > 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [
    referrers,
    search,
    statusFilter,
  ]);

  /*
   * -------------------------------------------------------
   * آمار کلی
   * -------------------------------------------------------
   */
  const totalReferrals = useMemo(
    () =>
      referrers.reduce(
        (sum, item) =>
          sum + item.referral_count,
        0
      ),
    [referrers]
  );

  const totalRewards = useMemo(
    () =>
      referrers.reduce(
        (sum, item) =>
          sum + item.reward_count,
        0
      ),
    [referrers]
  );

  const totalRewardAmount = useMemo(
    () =>
      referrers.reduce(
        (sum, item) =>
          sum + item.total_reward,
        0
      ),
    [referrers]
  );

  const totalPending = useMemo(
    () =>
      referrers.reduce(
        (sum, item) =>
          sum + item.pending_reward,
        0
      ),
    [referrers]
  );

  const totalPaid = useMemo(
    () =>
      referrers.reduce(
        (sum, item) =>
          sum + item.paid_reward,
        0
      ),
    [referrers]
  );

  /*
   * -------------------------------------------------------
   * Auth loading
   * -------------------------------------------------------
   */
  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="در حال بررسی دسترسی..." />
      </div>
    );
  }

  /*
   * -------------------------------------------------------
   * دسترسی
   * -------------------------------------------------------
   */
  if (!user || !isAdmin) {
    return (
      <div
        dir="rtl"
        className="mx-auto max-w-md p-8 text-center"
      >
        <div className="rounded-[24px] border border-[#E3EBDE] bg-white p-6 shadow-sm">
          <div className="text-4xl">🔐</div>

          <p className="mt-3 text-sm font-black text-[#1D2B1F]">
            دسترسی غیرمجاز
          </p>

          <p className="mt-2 text-[11px] leading-6 text-[#8A968C]">
            این صفحه فقط برای مدیران سایت قابل
            دسترسی است.
          </p>
        </div>
      </div>
    );
  }

  /*
   * -------------------------------------------------------
   * UI
   * -------------------------------------------------------
   */
  return (
    <div
      dir="rtl"
      className="mx-auto max-w-6xl space-y-5 bg-[#F7F9F4] px-4 py-6 md:px-6"
    >
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-[#1D2B1F]">
              🎁 باشگاه معرفی جم‌سیتی
            </h1>

            <p className="mt-1 text-xs text-[#8A968C]">
              مدیریت معرفی کاربران و پرداخت پاداش‌ها
            </p>
          </div>

          <button
            type="button"
            onClick={loadReferrers}
            disabled={loading}
            className="rounded-xl bg-[#147A4B] px-4 py-2.5 text-xs font-black text-white shadow-sm disabled:opacity-50"
          >
            🔄 بروزرسانی
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-center text-xs font-bold ${
            message.type === "ok"
              ? "bg-[#EAF5ED] text-[#147A4B]"
              : "bg-[#FDEDEC] text-[#D94B40]"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatBox
          icon="👥"
          label="معرف‌ها"
          value={referrers.length}
        />

        <StatBox
          icon="🧑‍🤝‍🧑"
          label="معرفی موفق"
          value={totalReferrals}
        />

        <StatBox
          icon="🎁"
          label="پاداش‌ها"
          value={totalRewards}
        />

        <StatBox
          icon="🕐"
          label="در انتظار پرداخت"
          value={totalPending}
          toman
        />

        <StatBox
          icon="✅"
          label="پرداخت‌شده"
          value={totalPaid}
          toman
        />
      </div>

      {/* Total reward */}
      <div className="rounded-[22px] border border-[#F0DCB4] bg-gradient-to-l from-[#FFF3DA] to-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#8A7150]">
              مجموع تعهد پاداش‌ها
            </p>

            <p className="mt-1 text-2xl font-black text-[#D98F2B]">
              {formatToman(
                totalRewardAmount
              )}
            </p>
          </div>

          <div className="text-4xl">💰</div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="rounded-[22px] border border-[#E3EBDE] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="جست‌وجو نام، شماره یا کد معرفی..."
            className="w-full rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-4 py-3 text-xs font-bold text-[#1D2B1F] outline-none focus:border-[#147A4B]"
          />

          <div className="flex gap-2">
            <FilterButton
              active={
                statusFilter === "all"
              }
              onClick={() =>
                setStatusFilter("all")
              }
            >
              همه
            </FilterButton>

            <FilterButton
              active={
                statusFilter === "pending"
              }
              onClick={() =>
                setStatusFilter("pending")
              }
            >
              در انتظار
            </FilterButton>

            <FilterButton
              active={
                statusFilter === "paid"
              }
              onClick={() =>
                setStatusFilter("paid")
              }
            >
              پرداخت‌شده
            </FilterButton>
          </div>
        </div>
      </div>

      {/* Referrers table */}
      <div className="overflow-hidden rounded-[22px] border border-[#E3EBDE] bg-white shadow-sm">
        <div className="border-b border-[#EDF1EC] px-4 py-4">
          <h2 className="text-sm font-black text-[#1D2B1F]">
            👥 کاربران معرف
          </h2>

          <p className="mt-1 text-[10px] text-[#8A968C]">
            {formatNumber(
              filteredReferrers.length
            )}{" "}
            معرف نمایش داده می‌شود.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner label="در حال بارگذاری..." />
          </div>
        ) : filteredReferrers.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-4xl">🔎</div>

            <p className="mt-3 text-xs font-bold text-[#8A968C]">
              کاربری مطابق جست‌وجوی شما پیدا نشد.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-[#F7F9F4] text-[10px] text-[#8A968C]">
                    <th className="px-4 py-3">
                      کاربر
                    </th>

                    <th className="px-4 py-3">
                      کد معرفی
                    </th>

                    <th className="px-4 py-3">
                      معرفی موفق
                    </th>

                    <th className="px-4 py-3">
                      پاداش
                    </th>

                    <th className="px-4 py-3">
                      در انتظار
                    </th>

                    <th className="px-4 py-3">
                      پرداخت‌شده
                    </th>

                    <th className="px-4 py-3">
                      عملیات
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F1F4EF]">
                  {filteredReferrers.map(
                    (referrer) => (
                      <tr
                        key={referrer.id}
                        className="hover:bg-[#FAFCF9]"
                      >
                        <td className="px-4 py-4">
                          <p className="text-xs font-black text-[#1D2B1F]">
                            {referrer.display_name ||
                              "بدون نام"}
                          </p>

                          <p
                            dir="ltr"
                            className="mt-1 text-[9px] text-[#8A968C]"
                          >
                            {maskPhone(
                              referrer.username
                            )}
                          </p>
                        </td>

                        <td
                          dir="ltr"
                          className="px-4 py-4 text-xs font-black tracking-wider text-[#147A4B]"
                        >
                          {referrer.referral_code ||
                            "---"}
                        </td>

                        <td className="px-4 py-4 text-sm font-black text-[#1D2B1F]">
                          {formatNumber(
                            referrer.referral_count
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-full bg-[#EAF5ED] px-2.5 py-1 text-[9px] font-black text-[#147A4B]">
                            {formatNumber(
                              referrer.reward_count
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-xs font-black text-[#D98F2B]">
                          {formatToman(
                            referrer.pending_reward
                          )}
                        </td>

                        <td className="px-4 py-4 text-xs font-black text-[#147A4B]">
                          {formatToman(
                            referrer.paid_reward
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              openReferrer(
                                referrer
                              )
                            }
                            className="rounded-xl bg-[#147A4B] px-3 py-2 text-[10px] font-black text-white"
                          >
                            مشاهده
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="space-y-2 p-3 md:hidden">
              {filteredReferrers.map(
                (referrer) => (
                  <div
                    key={referrer.id}
                    className="rounded-[18px] border border-[#EDF1EC] bg-[#FAFCF9] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-[#1D2B1F]">
                          {referrer.display_name ||
                            "بدون نام"}
                        </p>

                        <p
                          dir="ltr"
                          className="mt-1 text-[9px] text-[#8A968C]"
                        >
                          {maskPhone(
                            referrer.username
                          )}
                        </p>
                      </div>

                      <span
                        dir="ltr"
                        className="rounded-lg bg-[#EAF5ED] px-2 py-1 text-[9px] font-black text-[#147A4B]"
                      >
                        {referrer.referral_code ||
                          "---"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <MiniStat
                        label="معرفی موفق"
                        value={formatNumber(
                          referrer.referral_count
                        )}
                      />

                      <MiniStat
                        label="پاداش"
                        value={formatNumber(
                          referrer.reward_count
                        )}
                      />

                      <MiniStat
                        label="در انتظار"
                        value={formatToman(
                          referrer.pending_reward
                        )}
                      />

                      <MiniStat
                        label="پرداخت‌شده"
                        value={formatToman(
                          referrer.paid_reward
                        )}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openReferrer(
                          referrer
                        )
                      }
                      className="mt-3 w-full rounded-xl bg-[#147A4B] py-2.5 text-[10px] font-black text-white"
                    >
                      مشاهده پاداش‌ها
                    </button>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* Selected referrer */}
      {selectedReferrer && (
        <div className="rounded-[24px] border border-[#E3EBDE] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-black text-[#1D2B1F]">
                🎁 پاداش‌های{" "}
                {selectedReferrer.display_name ||
                  "کاربر"}
              </p>

              <p
                dir="ltr"
                className="mt-1 text-[10px] text-[#8A968C]"
              >
                {selectedReferrer.referral_code ||
                  "---"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedReferrer(null);
                setSelectedRewards([]);
              }}
              className="rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-2 text-[10px] font-black text-[#59665C]"
            >
              بستن
            </button>
          </div>

          {rewardsLoading ? (
            <div className="flex justify-center py-10">
              <Spinner label="در حال دریافت پاداش‌ها..." />
            </div>
          ) : selectedRewards.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-[#8A968C]">
              هنوز پاداشی برای این کاربر ایجاد نشده است.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {selectedRewards.map(
                (reward) => (
                  <div
                    key={reward.id}
                    className="rounded-[18px] border border-[#EDF1EC] bg-[#FAFCF9] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-[#1D2B1F]">
                          پاداش مرحله{" "}
                          {formatNumber(
                            reward.level
                          )}
                        </p>

                        <p className="mt-1 text-[9px] text-[#8A968C]">
                          رسیدن به{" "}
                          {formatNumber(
                            reward.referral_count
                          )}{" "}
                          معرفی موفق
                        </p>

                        <p className="mt-1 text-sm font-black text-[#147A4B]">
                          {formatToman(
                            reward.amount_toman
                          )}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[9px] font-black ${
                            reward.status ===
                            "paid"
                              ? "bg-[#EAF5ED] text-[#147A4B]"
                              : "bg-[#FFF3DA] text-[#B47A19]"
                          }`}
                        >
                          {reward.status ===
                          "paid"
                            ? "✅ پرداخت شده"
                            : "🕐 در انتظار پرداخت"}
                        </span>

                        <button
                          type="button"
                          disabled={
                            actionLoading ===
                            reward.id
                          }
                          onClick={() =>
                            toggleRewardStatus(
                              reward
                            )
                          }
                          className={`rounded-xl px-3 py-2 text-[9px] font-black text-white disabled:opacity-50 ${
                            reward.status ===
                            "paid"
                              ? "bg-[#8A968C]"
                              : "bg-[#147A4B]"
                          }`}
                        >
                          {actionLoading ===
                          reward.id
                            ? "در حال ثبت..."
                            : reward.status ===
                              "paid"
                            ? "برگشت به انتظار پرداخت"
                            : "ثبت پرداخت"}
                        </button>
                      </div>
                    </div>

                    {reward.paid_at && (
                      <p className="mt-3 border-t border-[#EDF1EC] pt-2 text-[8px] text-[#A1AAA3]">
                        تاریخ پرداخت:{" "}
                        {new Date(
                          reward.paid_at
                        ).toLocaleString(
                          "fa-IR"
                        )}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      <p className="pb-6 text-center text-[9px] leading-6 text-[#A1AAA3]">
        سیستم پاداش: هر ۲۰ معرفی موفق = یک
        پاداش ۲۰٬۰۰۰ تومانی.
        <br />
        پرداخت پاداش‌ها توسط مدیریت به صورت دستی
        ثبت می‌شود.
      </p>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  toman = false,
}: {
  icon: string;
  label: string;
  value: number;
  toman?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-[#E3EBDE] bg-white p-3 text-center shadow-sm">
      <div className="text-xl">{icon}</div>

      <p className="mt-1 text-base font-black text-[#1D2B1F]">
        {toman
          ? formatToman(value)
          : formatNumber(value)}
      </p>

      <p className="mt-1 text-[9px] font-bold text-[#8A968C]">
        {label}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white p-2 text-center">
      <p className="text-[8px] text-[#8A968C]">
        {label}
      </p>

      <p className="mt-1 text-[10px] font-black text-[#1D2B1F]">
        {value}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-[9px] font-black transition ${
        active
          ? "bg-[#147A4B] text-white"
          : "bg-[#F7F9F4] text-[#59665C]"
      }`}
    >
      {children}
    </button>
  );
}

