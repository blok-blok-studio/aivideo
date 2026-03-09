const BASE_URL = "https://api.elevenlabs.io/v1";

function headers() {
  return {
    "xi-api-key": process.env.ELEVENLABS_API_KEY || "",
    "Content-Type": "application/json",
  };
}

export async function generateSpeech(params: {
  voiceId: string;
  text: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}): Promise<ArrayBuffer> {
  const {
    voiceId,
    text,
    modelId = "eleven_multilingual_v2",
    stability = 0.5,
    similarityBoost = 0.75,
  } = params;

  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability, similarity_boost: similarityBoost },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${err}`);
  }

  return res.arrayBuffer();
}

export async function instantClone(params: {
  name: string;
  audioBlob: Blob;
}): Promise<string> {
  const formData = new FormData();
  formData.append("name", params.name);
  formData.append("files", params.audioBlob);

  const res = await fetch(`${BASE_URL}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs clone failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.voice_id;
}

export async function listVoices() {
  const res = await fetch(`${BASE_URL}/voices`, {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
  });
  if (!res.ok) throw new Error("Failed to fetch voices");
  return res.json();
}

export async function deleteVoice(voiceId: string) {
  const res = await fetch(`${BASE_URL}/voices/${voiceId}`, {
    method: "DELETE",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
  });
  if (!res.ok) throw new Error("Failed to delete voice");
}
