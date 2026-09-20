/**
 * HP-003 — the home page's footer. It is where the landing page's
 * surviving content lives now that the landing page is gone: the
 * documentation link, the social row, the copyright line, and the three
 * legal links.
 *
 * HP-005 — Terms, Privacy and Market Integrity are reachable from `/`
 * with zero login and one click, which is what L-004 requires and what
 * the one-time acceptance gate links to.
 */
import type { ComponentType } from "react";
import type { LegalDoc } from "@/components/legal/LegalPage.tsx";
import { XIcon, RedditIcon, LinkedInIcon, SubstackIcon, DiscordIcon } from "./social-icons.tsx";

/** Social channels, in the order the owner set on the landing page. */
const SOCIAL_LINKS: {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { label: "X", href: "https://x.com/Mantua_AI", icon: XIcon },
  { label: "Discord", href: "https://discord.gg/kUfEpzvaFf", icon: DiscordIcon },
  { label: "Substack", href: "https://substack.com/@mantuanews", icon: SubstackIcon },
  { label: "Reddit", href: "https://www.reddit.com/r/MantuaAI/", icon: RedditIcon },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/mantuaai/?viewAsMember=true",
    icon: LinkedInIcon,
  },
];

/** Policy links sharing the copyright line — each opens its own page. */
const LEGAL_LINKS: { label: string; doc: LegalDoc }[] = [
  { label: "Privacy", doc: "privacy" },
  { label: "Terms of Use", doc: "terms" },
  { label: "Market Integrity", doc: "integrity" },
];

interface Props {
  onOpenLegal: (doc: LegalDoc) => void;
  onOpenDocs: () => void;
}

export function Footer({ onOpenLegal, onOpenDocs }: Props) {
  return (
    <footer className="mt-10 border-t border-border-soft pt-8">
      <div className="mx-auto max-w-4xl text-center">
        <button
          type="button"
          onClick={onOpenDocs}
          className="text-[13px] font-semibold text-text hover:text-accent transition-colors cursor-pointer"
        >
          Documentation
        </button>

        <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-text-mute">Social Media</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[13px]">
          {SOCIAL_LINKS.map((l, i) => {
            const Icon = l.icon;
            return (
              <span key={l.label} className="flex items-center gap-x-2">
                {i > 0 && <span className="text-text-mute">-</span>}
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-text-dim hover:text-accent transition-colors"
                >
                  <Icon className="h-[15px] w-[15px]" />
                  {l.label}
                </a>
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pb-2 text-[11px] text-text-mute">
        <span>© 2026 Mantua Intelligence. All rights reserved.</span>
        {LEGAL_LINKS.map((l) => (
          <span key={l.label} className="flex items-center gap-x-2">
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                onOpenLegal(l.doc);
              }}
              className="hover:text-accent transition-colors cursor-pointer"
            >
              {l.label}
            </button>
          </span>
        ))}
      </div>
    </footer>
  );
}
