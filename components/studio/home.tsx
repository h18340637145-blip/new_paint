"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Composer, type ComposerInput } from "./composer";
import { submitGeneration } from "@/lib/studio/client";

export function HomeComposer() {
  const router = useRouter();
  const draft = useRef<{ projectId: string; submissionId: string; assetId: string; file: File | null; prompt: string } | null>(null);

  async function send(input: ComposerInput) {
    if (!draft.current || draft.current.prompt !== input.prompt || draft.current.file !== input.file) {
      draft.current = {
        projectId: draft.current?.projectId ?? crypto.randomUUID(),
        submissionId: crypto.randomUUID(), assetId: crypto.randomUUID(),
        prompt: input.prompt, file: input.file,
      };
    }
    const { projectId, submissionId, assetId } = draft.current;
    await submitGeneration(input, projectId, submissionId, assetId, true);
    draft.current = null;
    router.push(`/canvas?projectId=${projectId}`);
  }

  return <Composer home onSend={send} />;
}
