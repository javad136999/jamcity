  return (
    <div className="fade-in fixed inset-0 h-[100dvh] min-h-0 box-border flex flex-col overflow-hidden pt-[6.5rem] pb-[env(safe-area-inset-bottom)]">

      {memberCount !== null && (
        <div className="mb-1.5 flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-emerald-50 py-1 text-[10px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          {memberCount.toLocaleString("fa-IR")} عضو در دیوار شهر جم
        </div>
      )}

      {/* Header */}
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-base font-extrabold text-slate-800 sm:text-xl">
            دیوار شهر جم
          </h1>
          <p className="text-[10px] text-slate-400 sm:text-xs">
            وارد شده‌اید با نام کاربری «{profile?.display_name}»
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-base sm:h-10 sm:w-10 sm:text-lg"
            title="لیست چت‌های من"
          >
            ✉️
          </Link>
        </div>
      </div>

      {/* Search + categories */}
      <div className="mb-2 shrink-0 space-y-1.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();

            if (searchInput.trim()) {
              startBrowse(searchInput, null);
            }
          }}
          className="flex items-center gap-2"
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="جستجو در آگهی‌های دیوار (مثلاً خودرو، اجاره، ...)"
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-800 outline-none focus:border-jam-green"
          />

          <button
            type="submit"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-jam-green text-white shadow-glow"
          >
            🔍
          </button>
        </form>

        {/* Category + Share buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">

          {/* خودرو */}
          <button
            onClick={() => startBrowse("خودرو", null)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700"
          >
            🚗 آگهی‌های خودرو
          </button>

          {/* معرفی به دوستان */}
          <button
            type="button"
            onClick={async () => {
              const shareData = {
                title: "دیوار شهر جم",
                text: "دیوار شهر جم؛ آگهی‌ها و گفتگوهای شهر جم را ببینید 👇",
                url: window.location.origin + "/wall",
              };

              if (navigator.share) {
                try {
                  await navigator.share(shareData);
                } catch {
                  // کاربر پنجره اشتراک‌گذاری را بسته است
                }
              } else {
                try {
                  await navigator.clipboard.writeText(shareData.url);
                  alert(
                    "لینک دیوار شهر جم کپی شد؛ می‌توانید برای دوستانتان ارسال کنید."
                  );
                } catch {
                  alert("کپی لینک انجام نشد.");
                }
              }
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-600"
          >
            📤 معرفی به دوستان
          </button>

          {/* املاک */}
          <button
            onClick={() => startBrowse("املاک", null)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700"
          >
            🏠 آگهی‌های املاک
          </button>

        </div>
      </div>

      {/* Browse / Messages */}
      {browse ? (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl2 glass p-4 shadow-soft">

          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500">
              {browseResults.length > 0
                ? `${browseIndex + 1} از ${browseResults.length} آگهی`
                : "نتیجه‌ای یافت نشد"}
            </p>

            <button
              onClick={() => setBrowse(null)}
              className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-slate-600"
            >
              ✕ بستن جستجو
            </button>
          </div>

          {browseResults.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">
              آگهی‌ای با این مشخصات پیدا نشد.
            </p>
          ) : (
            (() => {
              const m = browseResults[browseIndex];
              const cat = m.category ? CATEGORY_META[m.category] : null;

              return (
                <div className="space-y-3 rounded-xl2 border border-slate-200 bg-white p-4">

                  <button
                    onClick={() => openChatWith(m.user_id)}
                    className="flex items-center gap-2 text-xs font-bold text-orange-500"
                  >
                    <Avatar
                      url={m.profiles?.avatar_url}
                      name={m.profiles?.display_name}
                      size={24}
                    />
                    {m.profiles?.display_name || "کاربر"}
                  </button>

                  {cat && (
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      {cat.icon} {cat.label}
                    </span>
                  )}

                  {m.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.image_url}
                      alt=""
                      className="max-h-72 w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  )}

                  {m.content && (
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {m.content}
                    </p>
                  )}

                  <p className="text-[10px] text-slate-400">
                    {timeAgo(m.created_at)}
                  </p>

                  <div className="flex items-center justify-between border-t border-black/5 pt-3">

                    <button
                      onClick={() => reportUser(m.user_id, m.content)}
                      className="text-[11px] font-bold text-slate-400"
                    >
                      🚩 گزارش
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setBrowseIndex((i) =>
                            Math.min(browseResults.length - 1, i + 1)
                          )
                        }
                        disabled={browseIndex >= browseResults.length - 1}
                        className="rounded-full bg-jam-green px-4 py-2 text-xs font-bold text-white shadow-glow disabled:opacity-40"
                      >
                        ▲ بعدی
                      </button>

                      <button
                        onClick={() =>
                          setBrowseIndex((i) => Math.max(0, i - 1))
                        }
                        disabled={browseIndex <= 0}
                        className="rounded-full bg-black/5 px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"
                      >
                        ▼ قبلی
                      </button>
                    </div>

                  </div>
                </div>
              );
            })()
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl2 glass p-4 shadow-soft">

          {messages === null ? (
            <Spinner label="در حال بارگذاری پیام‌ها..." />
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              هنوز پیامی ارسال نشده. اولین نفری باشید که پیام می‌گذارد!
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.user_id === user.id;
              const isAdCard = !!m.image_url && !!m.content;
              const liked = likedByMe.has(m.id);
              const count = likeCounts[m.id] ?? 0;

              if (isAdCard) {
                return (
                  <div
                    key={m.id}
                    className={`flex ${
                      mine ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div className="max-w-[85%] overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-soft">

                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.image_url!}
                        alt=""
                        className="max-h-72 w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />

                      <div className="space-y-2 p-3">

                        <button
                          onClick={() => openChatWith(m.user_id)}
                          className="flex items-center gap-2 text-[11px] font-bold text-orange-500"
                        >
                          <Avatar
                            url={m.profiles?.avatar_url}
                            name={m.profiles?.display_name}
                            size={20}
                          />
                          {m.profiles?.display_name || "کاربر"}
                        </button>

                        {m.category && (
                          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {CATEGORY_META[m.category].icon}{" "}
                            {CATEGORY_META[m.category].label}
                          </span>
                        )}

                        <p className="whitespace-pre-wrap text-sm font-bold text-slate-800">
                          {m.content}
                        </p>

                        <div className="flex items-center justify-between">

                          <p className="text-[10px] text-slate-400">
                            {timeAgo(m.created_at)}
                          </p>

                          <div className="flex items-center gap-3">

                            {!mine && (
                              <button
                                onClick={() =>
                                  reportUser(m.user_id, m.content)
                                }
                                className="text-[10px] text-slate-300"
                                title="گزارش"
                              >
                                🚩
                              </button>
                            )}

                            <button
                              onClick={() => toggleLike(m.id)}
                              className={`flex items-center gap-1 text-xs font-bold ${
                                liked
                                  ? "text-red-500"
                                  : "text-slate-400"
                              }`}
                            >
                              {liked ? "❤️" : "🤍"}{" "}
                              {count > 0 && count}
                            </button>

                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={m.id}
                  className={`flex ${
                    mine ? "justify-start" : "justify-end"
                  }`}
                >
                  <div className="flex max-w-[75%] items-end gap-2">

                    {!mine && (
                      <button
                        onClick={() => openChatWith(m.user_id)}
                        className="mb-1"
                      >
                        <Avatar
                          url={m.profiles?.avatar_url}
                          name={m.profiles?.display_name}
                          size={28}
                        />
                      </button>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-2 shadow-sm ${
                        mine
                          ? "bg-jam-green text-white"
                          : "bg-white text-slate-800"
                      }`}
                    >

                      {!mine && (
                        <button
                          onClick={() => openChatWith(m.user_id)}
                          className="mb-0.5 text-[11px] font-bold text-orange-500"
                        >
                          {m.profiles?.display_name || "کاربر"}
                        </button>
                      )}

                      {m.category && (
                        <span className="mb-0.5 mr-1 inline-block rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold">
                          {CATEGORY_META[m.category].icon}{" "}
                          {CATEGORY_META[m.category].label}
                        </span>
                      )}

                      {m.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image_url}
                          alt=""
                          className="mb-1 max-h-64 w-full rounded-xl object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      )}

                      {m.content && (
                        <p className="whitespace-pre-wrap text-sm">
                          {m.content}
                        </p>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-3">

                        <p className="text-[10px] opacity-60">
                          {timeAgo(m.created_at)}
                        </p>

                        <div className="flex items-center gap-3">

                          {!mine && (
                            <button
                              onClick={() =>
                                reportUser(m.user_id, m.content)
                              }
                              className="text-[10px] opacity-50"
                              title="گزارش"
                            >
                              🚩
                            </button>
                          )}

                          <button
                            onClick={() => toggleLike(m.id)}
                            className={`flex items-center gap-1 text-[11px] font-bold ${
                              mine
                                ? "text-white/80"
                                : liked
                                ? "text-red-500"
                                : "text-slate-400"
                            }`}
                          >
                            {liked ? "❤️" : "🤍"}{" "}
                            {count > 0 && count}
                          </button>

                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div ref={bottomRef} />

        </div>
      )}

      {/* Send message */}
      <div className="mt-2 shrink-0 space-y-1 pb-[4.5rem]">

        {sendError && <ErrorState message={sendError} />}

        <div className="flex items-end gap-2 rounded-xl2 glass p-2 shadow-soft">

          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/5 text-lg">
            📷

            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                setImage(e.target.files?.[0] ?? null)
              }
            />
          </label>

          <EmojiPicker
            onPick={(emoji) =>
              setText((prev) => prev + emoji)
            }
          />

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="پیام خود را بنویسید..."
            rows={1}
            className="flex-1 resize-none rounded-xl2 border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-jam-green"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jam-green text-white shadow-glow disabled:opacity-50"
          >
            ➤
          </button>

        </div>

        {image && (
          <p className="text-xs text-slate-400">
            تصویر انتخاب شد: {image.name}
          </p>
        )}

      </div>

    </div>
  );
}