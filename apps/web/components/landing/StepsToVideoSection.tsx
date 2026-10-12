import { landingContent } from "@/content/landing";

export function StepsToVideoSection() {
  const { howToGet } = landingContent;

  return (
    <section className="pt-10 flex flex-col gap-4">
      <h2 className="text-2xl font-bold leading-[1.2] text-siyoh m-0">
        {howToGet.title}
      </h2>

      <ol className="m-0 p-0 list-none flex flex-col gap-4 text-siyoh">
        {howToGet.steps.map((step) => {
          const isGold = step.number === 3;
          return (
            <li key={step.number} className="flex gap-4 items-center">
              <span className="shrink-0 w-[34px] h-[34px] flex items-center justify-center">
                <span
                  className={`w-6 h-6 rotate-45 flex items-center justify-center ${
                    isGold ? "bg-oltin" : "bg-siyoh"
                  }`}
                >
                  <span
                    className={`-rotate-45 text-[13px] font-bold select-none ${
                      isGold ? "text-siyoh" : "text-varaq"
                    }`}
                  >
                    {step.number}
                  </span>
                </span>
              </span>
              <span className="text-[17px] leading-[1.4]">{step.text}</span>
            </li>
          );
        })}
      </ol>

      <p className="text-sm leading-[1.5] text-qalam pt-1 m-0">
        {howToGet.privacyText}
      </p>
    </section>
  );
}
