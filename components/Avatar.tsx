import { isEmojiAvatar, avatarEmoji } from "@/lib/constants";

export default function Avatar({
  url,
  name,
  size = 36,
  className = "",
}: {
  url: string | null | undefined;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: size * 0.55 };

  if (url && isEmojiAvatar(url)) {
    return (
      <span
        style={style}
        className={`flex shrink-0 items-center justify-center rounded-full bg-amber-50 ${className}`}
      >
        {avatarEmoji(url)}
      </span>
    );
  }

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? ""}
        style={style}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full bg-jam-darkgreen font-bold text-white ${className}`}
    >
      {name?.[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
