import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

interface TTSBody {
  text?: string;
}

/**
 * Server-side proxy to ElevenLabs.
 * The API key is read from process.env.ELEVENLABS_API_KEY and never
 * sent to the browser.
 *
 * Body: { text: string }
 * Response: audio/mpeg stream
 *
 * Voice: fixed from ELEVENLABS_VOICE_ID only (never from request body).
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    console.error("ElevenLabs API key not found");
    return jsonError("missing_api_key", 500);
  }

  let body: TTSBody;
  try {
    body = (await req.json()) as TTSBody;
  } catch {
    return jsonError("invalid_body", 400);
  }

  const text = (body.text ?? "").trim();
  if (!text) return jsonError("empty_text", 400);
  if (text.length > 1500) return jsonError("text_too_long", 413);

  // Voice is fixed — env only. Never read from the client body.
  const voiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL";

  // Model is hard-locked. Do NOT read from env — a stale .env file or a
  // misconfigured deployment must never silently switch models. This is
  // the only Arabic-stable model and we depend on its prosody.
  const modelId = "eleven_multilingual_v2";

  // Insert SSML break tags around punctuation/ellipses for natural cadence.
  // CRITICAL: this transformation is purely additive — it inserts <break/>
  // tags but never modifies, removes, or normalizes any character. Arabic
  // letters AND tashkeel (e.g. حَقْن, مَنَوي, حَمْل) are passed through
  // verbatim to ElevenLabs so pronunciation cues authored in
  // lib/conversation.ts are respected.
  const enriched = enrichForNaturalPauses(text);

  // Visibility log so you can see exactly what was sent to ElevenLabs.
  console.log(
    `[TTS] → ElevenLabs  voice=${voiceId}  model=${modelId}  chars=${text.length}  tashkeel=preserved`
  );

  let elRes: Response;
  try {
    elRes = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: enriched,
          model_id: modelId,
          // Stable, warm Egyptian-Arabic voice profile.
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.7,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );
  } catch (err) {
    return jsonError("upstream_unreachable", 502, String(err).slice(0, 200));
  }

  if (!elRes.ok) {
    let detail = "";
    try {
      detail = (await elRes.text()).slice(0, 500);
    } catch {
      /* ignore */
    }
    console.error(
      `[TTS] ElevenLabs upstream HTTP ${elRes.status} — ${detail || "(no body)"}`
    );
    return jsonError("elevenlabs_error", 502, detail, elRes.status);
  }

  return new Response(elRes.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Voice-Id": voiceId,
      "X-Voice-Model": modelId,
    },
  });
}

function jsonError(
  code: string,
  status: number,
  detail?: string,
  upstreamStatus?: number
) {
  return Response.json(
    { error: code, detail, upstreamStatus },
    { status }
  );
}

/**
 * Insert subtle SSML-style breaks for more natural cadence in Arabic.
 * `eleven_multilingual_v2` honors <break time="X.Xs" /> tags inside text.
 *
 * IMPORTANT — this function is intentionally PURELY ADDITIVE. It only
 * INSERTS break markers; it never strips, normalizes, or transforms the
 * input. Arabic diacritics (tashkeel) like فَتْحَة / كَسْرَة / ضَمَّة /
 * شَدَّة authored inside conversation.ts (e.g. حَقْن, حَمْل, مَنَوي)
 * pass through verbatim so pronunciation hints are honored downstream.
 */
function enrichForNaturalPauses(text: string): string {
  return (
    text
      // Long pause for ellipsis (Unicode … and triple ASCII dots)
      .replace(/(\u2026|\.{3})/g, ' <break time="0.55s" /> ')
      // Long pause after sentence enders (period, Arabic ?, !)
      .replace(/([.؟!])\s+/g, '$1 <break time="0.45s" /> ')
      // Short pause after Arabic comma and Latin comma
      .replace(/([،,])\s+/g, '$1 <break time="0.25s" /> ')
      // Tiny breath before the closing disclaimer phrase
      .replace(/(تقييم مبدئي)/g, '<break time="0.2s" /> $1')
      .trim()
  );
}
