type FireCallArgs = {
  toNumber: string;
  phnumId: string;
};

type FireCallResult =
  | { ok: true; conversationId: string; callSid: string | null }
  | { ok: false; status: number; error: string };

export async function fireElevenLabsCall({
  toNumber,
  phnumId,
}: FireCallArgs): Promise<FireCallResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.EL_AGENT_ID;
  const envTag = process.env.EL_ENV_TAG ?? "pdl";

  if (!apiKey) return { ok: false, status: 500, error: "ELEVENLABS_API_KEY missing" };
  if (!agentId) return { ok: false, status: 500, error: "EL_AGENT_ID missing" };

  const res = await fetch(
    "https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call",
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phnumId,
        to_number: toNumber,
        conversation_initiation_client_data: {
          dynamic_variables: { env: envTag },
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text || res.statusText };
  }

  const data = (await res.json()) as {
    conversation_id?: string;
    callSid?: string;
    call_sid?: string;
  };

  return {
    ok: true,
    conversationId: data.conversation_id ?? "",
    callSid: data.callSid ?? data.call_sid ?? null,
  };
}
