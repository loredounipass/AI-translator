import { useState, useRef, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "contexts/AuthContext";

interface UserAvatarProps {
    user: User;
    onOpenApiSettings?: () => void;
}

const md5 = (s: string): string => {
  const utf8 = new TextEncoder().encode(s);
  const ch = (n: number) => ("0" + ((n >>> 0) & 0xff).toString(16)).slice(-2);
  const rot = (n: number, b: number) => (n << b) | (n >>> (32 - b));
  const add = (a: number, b: number) => (a + b) | 0;
  const F = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const G = (x: number, y: number, z: number) => (x & z) | (y & ~z);
  const H = (x: number, y: number, z: number) => x ^ y ^ z;
  const I = (x: number, y: number, z: number) => y ^ (x | ~z);
  const K = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];
  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const pad = (b: number[]): string => { const n = b.length * 8; const p: number[] = [...b, 0x80]; while ((p.length * 8) % 512 !== 448) p.push(0); p.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff, 0, 0, 0, 0); return String.fromCharCode(...p); };
  const data = pad(Array.from(utf8));
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let i = 0; i < data.length; i += 64) {
    const w: number[] = [];
    for (let j = 0; j < 64; j += 4) w.push(data.charCodeAt(i + j) | (data.charCodeAt(i + j + 1) << 8) | (data.charCodeAt(i + j + 2) << 16) | (data.charCodeAt(i + j + 3) << 24));
    let a = a0, b = b0, c = c0, d = d0;
    for (let t = 0; t < 64; t++) {
      const f = t < 16 ? F(b, c, d) : t < 32 ? G(b, c, d) : t < 48 ? H(b, c, d) : I(b, c, d);
      const g = t < 16 ? t : t < 32 ? (5 * t + 1) % 16 : t < 48 ? (3 * t + 5) % 16 : (7 * t) % 16;
      const temp = add(add(add(rot(a, S[t]), f), K[t]), w[g]);
      a = d; d = c; c = b; b = add(b, rot(temp, S[t]));
    }
    a0 = add(a0, a); b0 = add(b0, b); c0 = add(c0, c); d0 = add(d0, d);
  }
  return ch(a0) + ch(b0) + ch(c0) + ch(d0);
};

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const UserAvatar = ({ user, onOpenApiSettings }: UserAvatarProps) => {
    const [open, setOpen] = useState(false);
    const [imgError, setImgError] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { logout } = useAuth();

    const rawAvatarUrl = user.user_metadata?.avatar_url;
    const avatarUrl = typeof rawAvatarUrl === "string" && rawAvatarUrl.startsWith("https://")
        ? rawAvatarUrl
        : !imgError && user.email
            ? `https://www.gravatar.com/avatar/${md5(user.email.trim().toLowerCase())}?s=200&d=identicon`
            : null;
    const userName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";

    const initials = userName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setOpen(!open)}
                className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex-shrink-0 focus:outline-none"
                aria-label="Menú de usuario"
            >
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={userName}
                        className="w-full h-full object-cover bg-slate-200 dark:bg-slate-600"
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                        {initials}
                    </div>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[80] animate-fadeIn">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {userName}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {user.email}
                        </p>
                    </div>

                    <div className="p-1">
                        <button
                            onClick={() => {
                                setOpen(false);
                                onOpenApiSettings?.();
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <KeyIcon />
                            API Keys
                        </button>
                        <button
                            onClick={async () => {
                                await logout();
                                setOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserAvatar;
