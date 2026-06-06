import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

/**
 * Voice is **locked** to a single ElevenLabs voice for the whole app.
 *
 * Resolution order (resolved ONCE at module load — never per request):
 *   1. process.env.ELEVENLABS_VOICE_ID (if set AND well-formed)
 *   2. CANONICAL_VOICE_ID below
 *
 * The client body NEVER influences voice selection. There is no
 * "random", "default", or per-request voice picking. Every request
 * uses this exact same voice_id, sent explicitly in the URL and
 * echoed back in the X-Voice-Id response header.
 */
const CANONICAL_VOICE_ID = "EXAVITQu4vr4xnSDxMaL" as const;
/** ElevenLabs voice IDs are short alphanumeric tokens (~20 chars). */
const VOICE_ID_FORMAT = /^[A-Za-z0-9]{16,32}$/;

const LOCKED_VOICE_ID: string = (() => {
  const fromEnv = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (fromEnv && VOICE_ID_FORMAT.test(fromEnv)) {
    if (fromEnv !== CANONICAL_VOICE_ID) {
      console.log(
        `[TTS] voice locked from env  voice=${fromEnv}  (canonical=${CANONICAL_VOICE_ID})`
      );
    } else {
      console.log(`[TTS] voice locked  voice=${fromEnv}`);
    }
    return fromEnv;
  }
  if (fromEnv) {
    console.warn(
      `[TTS] ignoring malformed ELEVENLABS_VOICE_ID="${fromEnv}" — falling back to canonical voice`
    );
  } else {
    console.log(`[TTS] voice locked  voice=${CANONICAL_VOICE_ID} (canonical)`);
  }
  return CANONICAL_VOICE_ID;
})();

/**
 * Hard-locked TTS model — never overridable.
 *
 * `eleven_multilingual_v2` is the best-quality Arabic-capable model
 * currently in general availability. It delivers richer prosody and
 * cleaner diction than `eleven_turbo_v2_5` (which sacrifices expressivity
 * for latency) and is more dependable than the still-alpha `eleven_v3`.
 * For a premium healthcare assistant, expressivity + reliability win.
 */
const LOCKED_MODEL_ID = "eleven_multilingual_v2" as const;

/**
 * Hard-locked voice settings — applied to every request.
 *
 * Premium healthcare-assistant profile (Egyptian Arabic, female, warm):
 *
 *   • stability=0.45       slight controlled variability so the voice
 *                          breathes; full empathy without monotone drift.
 *   • similarity_boost=0.80  keep close to the chosen voice timbre so it
 *                          doesn't slip into a generic neutral tone.
 *   • style=0.45           let the model express warmth and gentle
 *                          empathy without over-acting — important for
 *                          sensitive fertility topics.
 *   • use_speaker_boost=true   crisper, more present voice over speakers
 *                              and small mobile speakers.
 *
 * Trade-off notes:
 *   - Lowering stability further (<0.35) sounds emotional but starts
 *     hallucinating pitch on long Arabic words.
 *   - Raising style >0.6 sounds theatrical / over-dramatic, which is
 *     inappropriate for medical contexts.
 *   - similarity_boost <0.6 makes the voice drift from its identity
 *     between sentences, hurting the "same warm person" perception.
 */
const LOCKED_VOICE_SETTINGS = {
  stability: 0.45,
  similarity_boost: 0.8,
  style: 0.45,
  use_speaker_boost: true,
} as const;

interface TTSBody {
  text?: string;
}

/**
 * Server-side proxy to ElevenLabs.
 * The API key is read from process.env.ELEVENLABS_API_KEY and never
 * sent to the browser.
 *
 * Body: { text: string }   ← only `text` is read; any other field is ignored.
 * Response: audio/mpeg stream
 *
 * Voice / model / voice_settings are LOCKED at module scope above and
 * are sent explicitly on every request.
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

  // Defensive: ignore any voice_id / model_id passed by the client. The
  // locked values above are the ONLY values that ever leave this server.
  const voiceId = LOCKED_VOICE_ID;
  const modelId = LOCKED_MODEL_ID;

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
          // Voice + model + settings are locked and sent explicitly on
          // every request. Never derived from the client body.
          voice_id: voiceId,
          model_id: modelId,
          voice_settings: LOCKED_VOICE_SETTINGS,
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
 *
 * Pause budget tuned for a warm, unrushed healthcare voice — slightly
 * longer than "news anchor" defaults so empathetic phrasing has room to
 * breathe.
 */
function enrichForNaturalPauses(text: string): string {
  return (
    text
      // Long, contemplative pause for ellipsis (Unicode … and triple dots).
      .replace(/(\u2026|\.{3})/g, ' <break time="0.6s" /> ')
      // Sentence enders — full settle of the prior thought.
      .replace(/([.؟!])\s+/g, '$1 <break time="0.5s" /> ')
      // Commas get a soft breath, not a hard stop.
      .replace(/([،,])\s+/g, '$1 <break time="0.28s" /> ')
      // Micro-breath after common Arabic connectors / softeners when
      // they appear mid-sentence — adds the natural "thinking aloud"
      // cadence of a clinician.
      .replace(
        /(\s)(يعني|بس|طيب|تمام|ماشي|كده|كمان|بصي|بصراحة|في الحقيقة)(\s)/g,
        '$1$2 <break time="0.18s" /> $3'
      )
      // Gentle lift before empathy / supportive openers.
      .replace(
        /(\s)(إحنا معاكي|إحنا معاك|إحنا معاكم|ربنا)/g,
        '$1<break time="0.2s" /> $2'
      )
      // Tiny breath before the closing disclaimer phrase.
      .replace(/(تقييم مبدئي)/g, '<break time="0.2s" /> $1')
      .trim()
  );
}
