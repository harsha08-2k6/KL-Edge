function GitHubLogo(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2C6.48 2 2 6.58 2 12.22c0 4.52 2.86 8.35 6.84 9.71.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.46-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.56 2.35 1.11 2.92.85.09-.66.35-1.11.64-1.37-2.22-.26-4.55-1.13-4.55-5.03 0-1.11.39-2.02 1.03-2.73-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.04A9.31 9.31 0 0 1 12 6.95c.85 0 1.7.12 2.5.34 1.9-1.32 2.74-1.04 2.74-1.04.55 1.4.2 2.44.1 2.7.64.71 1.03 1.62 1.03 2.73 0 3.91-2.34 4.77-4.57 5.02.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.08 10.08 0 0 0 22 12.22C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function LinkedInLogo(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

const links = [
  {
    href: "https://github.com/harsha08-2k6/KL-Edge.git",
    label: "GitHub",
    icon: GitHubLogo,
    className: "hover:text-ink"
  },
  {
    href: "https://www.linkedin.com/in/siva-harsha-vardhan-reddy/",
    label: "LinkedIn",
    icon: LinkedInLogo,
    className: "hover:text-[#0a66c2]"
  }
];

export function SocialLinks({ showLinkedIn = true }) {
  return (
    <div className="flex items-center gap-1.5">
      {links.map((item) => {
        if (item.label === "LinkedIn" && !showLinkedIn) return null;
        const Icon = item.icon;

        return (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className={`tap inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink/10 bg-white text-ink/70 shadow-soft transition-colors ${item.className}`}
            title={item.label}
            aria-label={item.label}
          >
            <Icon className="h-[18px] w-[18px]" />
          </a>
        );
      })}
    </div>
  );
}
