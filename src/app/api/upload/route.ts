import { getUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { saveUpload } from "@/lib/uploads";

/**
 * POST /api/upload (multipart: file, kind=image|video|pdf).
 * Used by the post-property form and builder project tools. Validates by magic bytes and size.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ ok: false, error: "Log in to upload files." }, { status: 401 });
  const rl = await rateLimit(`upload:${user.id}`, 120, 3600);
  if (!rl.ok) return Response.json({ ok: false, error: "Too many uploads. Try again in a while." }, { status: 429 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: "Send the file as multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  const kind = String(form.get("kind") || "image");
  if (!(file instanceof File) || file.size === 0) return Response.json({ ok: false, error: "No file received." }, { status: 400 });
  const allowed = kind === "video" ? (["video"] as const) : kind === "pdf" ? (["pdf"] as const) : kind === "image_or_pdf" ? (["image", "pdf"] as const) : (["image"] as const);
  const res = await saveUpload(file, [...allowed]);
  if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 422 });
  return Response.json({ ok: true, url: res.file.url, sha256: res.file.sha256, kind: res.file.kind, width: res.file.width, height: res.file.height, name: file.name });
}
