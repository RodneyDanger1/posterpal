import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { ConnectCoach } from "@/components/connect-coach";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EASY_CONNECT_STEPS, META_HOW_IT_WORKS } from "@/lib/posterpal/meta-setup";
import { useAgentBriefStore } from "@/lib/store";

export const Route = createFileRoute("/connect")({
  component: () => (
    <Guard>
      <ConnectPage />
    </Guard>
  ),
});

function ConnectPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <PageHeader
        title="Connect Facebook"
        hint="Official Graph Login only. We open Meta’s own pages for creating the app and Pages. Public developer docs are loaded here so you can see the steps without scraping facebook.com."
        line="Four steps. You paste App ID/Secret. You click Facebook Login. The Agent can explain — it cannot log in for you."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            useAgentBriefStore.getState().queue(
              "Help me connect this desk to my Meta developer app. Graph v26.0 only. Explain App ID, Redirect URI, Development Mode, and Facebook Login. Do not invent a secret. Do not complete Login for me.",
              "connect",
            );
            void navigate({ to: "/agent" });
          }}
        >
          Ask agent
        </Button>
      </PageHeader>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">How Meta apps work</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          A Meta app is credentials Facebook issued. This homemade desk is PosterPal. Graph v26.0 is the only legal pipe. Scraping facebook.com is banned.
        </p>
        <dl className="mt-3 space-y-3">
          {META_HOW_IT_WORKS.map((block) => (
            <div key={block.title}>
              <dt className="text-[13px] font-semibold">{block.title}</dt>
              <dd className="mt-0.5 text-[13px] text-muted-foreground">{block.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Easy setup — four steps</h2>
        <ol className="mt-3 space-y-3">
          {EASY_CONNECT_STEPS.map((step) => (
            <li key={step.n} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[13px] font-semibold">{step.n}</span>
              <div>
                <div className="font-medium">{step.title}</div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{step.body}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => window.open(step.href, "_blank", "noopener,noreferrer")}
                >
                  Open official page
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <ConnectCoach
        onConnected={() => {
          toast.success("Pages imported. Nothing was posted.");
          void navigate({ to: "/" });
        }}
      />
    </div>
  );
}
