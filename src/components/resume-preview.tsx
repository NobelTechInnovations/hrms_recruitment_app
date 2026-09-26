import type { ResumeData } from "@/server/resume-pdf";
import { cx } from "./ui";

const TITLES: Record<string, string> = {
  summary: "Professional Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  certifications: "Certifications",
  projects: "Projects",
  languages: "Languages",
};

/** On-screen preview that mirrors the PDF templates. Always light, like paper. */
export function ResumePreview({ data }: { data: ResumeData }) {
  const t = data.template;
  const accent = { classic: "#111827", modern: "#4338ca", compact: "#0f766e", executive: "#b45309" }[t];
  const serif = t === "classic";
  const heading = (s: string) => (
    <h3 className={cx("mb-1.5 mt-4 border-b pb-0.5 font-semibold", t === "classic" ? "text-[11px] uppercase tracking-[0.15em]" : "text-sm")} style={{ color: accent, borderColor: t === "modern" ? accent : "#d1d5db" }}>
      {TITLES[s] ?? s}
    </h3>
  );
  return (
    <div className={cx("mx-auto w-full max-w-[210mm] bg-white text-[#1f2937] shadow-sm ring-1 ring-black/10", serif ? "font-serif" : "font-sans", t === "compact" ? "text-[11px] leading-snug" : "text-[12px] leading-relaxed")}>
      {t === "executive" ? (
        <div className="bg-[#111827] px-8 py-6 text-white">
          <p className="text-2xl font-bold">{data.name}</p>
          {data.headline ? <p className="text-sm text-amber-300">{data.headline}</p> : null}
          <p className="mt-1 text-[10px] text-gray-300">{data.contact.join("   |   ")}</p>
        </div>
      ) : (
        <div className={cx("px-8 pt-7", t === "classic" && "text-center")}>
          <p className="text-2xl font-bold" style={{ color: accent }}>
            {data.name}
          </p>
          {data.headline ? <p className="text-sm text-gray-700">{data.headline}</p> : null}
          <p className="mt-1 text-[10px] text-gray-500">{data.contact.join("   |   ")}</p>
          <div className="mt-3" style={{ height: t === "modern" ? 3 : 1, background: t === "modern" ? accent : "#9ca3af" }} />
        </div>
      )}
      <div className="px-8 pb-8 pt-1">
        {data.sections.map((s) => {
          if (s === "summary" && data.summary)
            return (
              <div key={s}>
                {heading(s)}
                <p>{data.summary}</p>
              </div>
            );
          if (s === "skills" && data.skills.length)
            return (
              <div key={s}>
                {heading(s)}
                <p>{data.skills.join("  •  ")}</p>
              </div>
            );
          if (s === "languages" && data.languages.length)
            return (
              <div key={s}>
                {heading(s)}
                <p>{data.languages.join(", ")}</p>
              </div>
            );
          if (s === "experience" && data.experiences.length)
            return (
              <div key={s}>
                {heading(s)}
                {data.experiences.map((e, i) => (
                  <div key={i} className="mb-2.5">
                    <p className="font-semibold text-gray-900">
                      {e.title} — {e.company}
                    </p>
                    <p className="text-[10px] italic text-gray-500">{[e.period, e.location].filter(Boolean).join("  ·  ")}</p>
                    {e.description ? (
                      <ul className="mt-0.5 list-disc pl-4">
                        {e.description
                          .split(/\n+/)
                          .filter(Boolean)
                          .map((l, j) => (
                            <li key={j}>{l.replace(/^[-•*]\s*/, "")}</li>
                          ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          if (s === "education" && data.educations.length)
            return (
              <div key={s}>
                {heading(s)}
                {data.educations.map((e, i) => (
                  <div key={i} className="mb-1.5">
                    <p className="font-semibold text-gray-900">{e.degree}</p>
                    <p className="text-gray-600">{[e.institution, e.period, e.grade].filter(Boolean).join("  ·  ")}</p>
                  </div>
                ))}
              </div>
            );
          if (s === "certifications" && data.certifications.length)
            return (
              <div key={s}>
                {heading(s)}
                <ul className="list-disc pl-4">
                  {data.certifications.map((c, i) => (
                    <li key={i}>{[c.name, c.issuer, c.year].filter(Boolean).join(" — ")}</li>
                  ))}
                </ul>
              </div>
            );
          if (s === "projects" && data.projects.length)
            return (
              <div key={s}>
                {heading(s)}
                {data.projects.map((p, i) => (
                  <div key={i} className="mb-1.5">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    {p.description ? <p>{p.description}</p> : null}
                    {p.url ? <p className="text-[10px]" style={{ color: accent }}>{p.url}</p> : null}
                  </div>
                ))}
              </div>
            );
          return null;
        })}
      </div>
    </div>
  );
}
