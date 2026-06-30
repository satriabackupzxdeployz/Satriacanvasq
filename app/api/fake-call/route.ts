import { NextRequest, NextResponse } from "next/server";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

const FONTS   = path.join(process.cwd(), "assets", "pack", "fonts");
const DEFAULT_AVATAR = path.join(process.cwd(), "assets", "iqcpink", "avatar-default.jpg");

const W = 1080;
const H = 2340;

let fontsLoaded = false;
function ensureFonts() {
  if (fontsLoaded) return;
  const medium = path.join(FONTS, "Inter-SemiBold.otf");
  const light  = path.join(FONTS, "Inter-Medium.otf");
  if (fs.existsSync(medium)) GlobalFonts.registerFromPath(medium, "CallMedium");
  if (fs.existsSync(light))  GlobalFonts.registerFromPath(light,  "CallLight");
  fontsLoaded = true;
}

async function loadAvatarSmart(file: File | null, url: string): Promise<Buffer> {
  if (file && file.size > 0) return Buffer.from(await file.arrayBuffer());
  if (url && url.startsWith("http")) {
    try { return Buffer.from(await (await fetch(url)).arrayBuffer()); } catch {}
  }
  return fs.readFileSync(DEFAULT_AVATAR);
}

function drawStatusBar(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 30px CallMedium";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("9:41", 56, 70);

  ctx.textAlign = "right";
  const sigX = W - 56;
  ctx.fillText("100%", sigX, 70);

  const battW = 50, battH = 24;
  const battX = sigX - 56;
  const battY = 70 - battH / 2;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(battX, battY, battW, battH);
  ctx.fillRect(battX + battW, battY + 6, 4, battH - 12);
  ctx.fillRect(battX + 3, battY + 3, battW - 6, battH - 6);
  ctx.restore();
}

function drawCircleButton(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawPhoneIcon(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, x: number, y: number, size: number, rotateDeg: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotateDeg * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.16;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const s = size * 0.5;
  ctx.moveTo(-s, -s * 0.35);
  ctx.bezierCurveTo(-s, -s * 0.9, -s * 0.4, -s, -s * 0.05, -s * 0.55);
  ctx.lineTo(s * 0.25, -s * 0.2);
  ctx.bezierCurveTo(s * 0.4, 0, s * 0.4, 0, s * 0.25, s * 0.25);
  ctx.lineTo(s * 0.0, s * 0.45);
  ctx.bezierCurveTo(-s * 0.55, s, -s, s * 0.4, -s, -s * 0.35);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

async function render(name: string, status: string, avatarBuf: Buffer): Promise<Buffer> {
  ensureFonts();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#3a3d52");
  grad.addColorStop(1, "#15161f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawStatusBar(ctx);

  const avatarCX = W / 2;
  const avatarCY = Math.round(H * 0.33);
  const avatarR  = Math.round(W * 0.34);

  const avatar = await loadImage(avatarBuf);
  const s  = Math.min(avatar.width, avatar.height);
  const sx = (avatar.width  - s) / 2;
  const sy = (avatar.height - s) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, sx, sy, s, s, avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 64px CallMedium";
  const nameY = avatarCY + avatarR + 110;
  ctx.fillText(name, W / 2, nameY);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "400 38px CallLight";
  ctx.fillText(status, W / 2, nameY + 64);

  const btnY = H - 280;
  const btnR = 80;
  const offsetX = W * 0.27;

  drawCircleButton(ctx, W / 2 - offsetX, btnY, btnR, "#ff3b30");
  drawPhoneIcon(ctx, W / 2 - offsetX, btnY, btnR, 135, "#ffffff");

  drawCircleButton(ctx, W / 2 + offsetX, btnY, btnR, "#34c759");
  drawPhoneIcon(ctx, W / 2 + offsetX, btnY, btnR, 0, "#ffffff");

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "400 28px CallLight";
  ctx.fillText("Tolak", W / 2 - offsetX, btnY + btnR + 50);
  ctx.fillText("Terima", W / 2 + offsetX, btnY + btnR + 50);

  return canvas.toBuffer("image/png");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const name   = (form.get("name")   as string | null)?.trim().slice(0, 30) || "Unknown";
    const status = (form.get("status") as string | null)?.trim().slice(0, 30) || "Panggilan masuk...";
    const avFile = form.get("avatar") as File | null;
    const avUrl  = (form.get("avatar_url") as string | null)?.trim() ?? "";

    const avatarBuf = await loadAvatarSmart(avFile, avUrl);
    const buffer = await render(name, status, avatarBuf);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": "inline; filename=\"fake-call.png\"",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const status = searchParams.get("status") ?? "Panggilan masuk...";
  const avatarUrl = searchParams.get("avatar_url") ?? "";
  if (!name?.trim()) return NextResponse.json({ error: "Parameter 'name' wajib diisi", example: "/api/fake-call?name=Mama&status=Panggilan+masuk..." }, { status: 400 });
  try {
    const avatarBuf = await loadAvatarSmart(null, avatarUrl);
    const buffer = await render(name.trim(), status.trim(), avatarBuf);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/png", "Content-Disposition": "inline; filename=\"fake-call.png\"", "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
