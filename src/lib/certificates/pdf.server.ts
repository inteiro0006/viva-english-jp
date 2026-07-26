// Server-only certificate PDF generator. Cloudflare Worker compatible.
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// Public Google Fonts static CDN — serves the OTF directly, Worker-fetchable.
// If the fetch fails we fall back to Helvetica (Latin glyphs only).
const NOTO_SANS_JP_URL =
  "https://fonts.gstatic.com/ea/notosansjp/v5/NotoSansJP-Regular.otf";
const NOTO_SANS_JP_BOLD_URL =
  "https://fonts.gstatic.com/ea/notosansjp/v5/NotoSansJP-Bold.otf";

let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

async function loadJpFonts(): Promise<
  { regular: ArrayBuffer; bold: ArrayBuffer } | null
> {
  if (fontCache) return fontCache;
  try {
    const [reg, bold] = await Promise.all([
      fetch(NOTO_SANS_JP_URL),
      fetch(NOTO_SANS_JP_BOLD_URL),
    ]);
    if (!reg.ok || !bold.ok) return null;
    const cache = {
      regular: await reg.arrayBuffer(),
      bold: await bold.arrayBuffer(),
    };
    fontCache = cache;
    return cache;
  } catch {
    return null;
  }
}

export interface CertificateFields {
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  hours?: number | null;
  certificateNumber: string;
  verificationCode: string;
  verificationUrl: string;
  language: "ja" | "en";
  institutionName: string;
  institutionTagline: string;
  signatoryName?: string | null;
}

function labels(lang: "ja" | "en") {
  if (lang === "ja") {
    return {
      title: "修了証",
      subtitle: "COURSE COMPLETION CERTIFICATE",
      awardedTo: "この証書は次の方に授与されます",
      completion: "は次のコースを修了したことを証明します",
      hours: "総学習時間",
      hoursUnit: "時間",
      issued: "発行日",
      number: "証明書番号",
      verify: "検証コード",
      verifyHint: "この証書は下記URLで検証できます",
      signature: "発行機関",
    };
  }
  return {
    title: "CERTIFICATE OF COMPLETION",
    subtitle: "修了証",
    awardedTo: "This certificate is proudly awarded to",
    completion: "for successfully completing the course",
    hours: "Total learning hours",
    hoursUnit: "hours",
    issued: "Issued on",
    number: "Certificate No.",
    verify: "Verification code",
    verifyHint: "Verify this certificate at",
    signature: "Issued by",
  };
}

function formatDate(d: Date, lang: "ja" | "en"): string {
  if (lang === "ja") {
    return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  }
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function renderCertificatePdf(
  f: CertificateFields,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const jp = await loadJpFonts();
  const regular = jp
    ? await doc.embedFont(jp.regular, { subset: true })
    : await doc.embedFont(StandardFonts.Helvetica);
  const bold = jp
    ? await doc.embedFont(jp.bold, { subset: true })
    : await doc.embedFont(StandardFonts.HelveticaBold);

  // A4 landscape
  const page = doc.addPage([842, 595]);
  const { width, height } = page.getSize();

  // Brand palette
  const green = rgb(0x00 / 255, 0x80 / 255, 0x61 / 255);
  const orange = rgb(0xf5 / 255, 0x82 / 255, 0x1f / 255);
  const ink = rgb(0.12, 0.14, 0.17);
  const muted = rgb(0.42, 0.45, 0.5);

  // Outer border
  const pad = 24;
  page.drawRectangle({
    x: pad,
    y: pad,
    width: width - pad * 2,
    height: height - pad * 2,
    borderColor: green,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: pad + 6,
    y: pad + 6,
    width: width - (pad + 6) * 2,
    height: height - (pad + 6) * 2,
    borderColor: orange,
    borderWidth: 1,
  });

  // Corner ornament
  for (const [cx, cy] of [
    [pad + 24, height - pad - 24],
    [width - pad - 24, height - pad - 24],
    [pad + 24, pad + 24],
    [width - pad - 24, pad + 24],
  ] as const) {
    page.drawCircle({ x: cx, y: cy, size: 6, color: orange });
  }

  const L = labels(f.language);

  // Institution mark (top)
  const inst = f.institutionName;
  page.drawText(inst, {
    x: width / 2 - bold.widthOfTextAtSize(inst, 14) / 2,
    y: height - 80,
    size: 14,
    font: bold,
    color: green,
  });

  // Title
  const titleSize = 34;
  page.drawText(L.title, {
    x: width / 2 - bold.widthOfTextAtSize(L.title, titleSize) / 2,
    y: height - 130,
    size: titleSize,
    font: bold,
    color: ink,
  });
  page.drawText(L.subtitle, {
    x: width / 2 - regular.widthOfTextAtSize(L.subtitle, 10) / 2,
    y: height - 150,
    size: 10,
    font: regular,
    color: muted,
  });

  // Awarded to
  page.drawText(L.awardedTo, {
    x: width / 2 - regular.widthOfTextAtSize(L.awardedTo, 12) / 2,
    y: height - 200,
    size: 12,
    font: regular,
    color: muted,
  });

  // Student name
  const nameSize = 30;
  const name = f.studentName;
  const nameWidth = bold.widthOfTextAtSize(name, nameSize);
  page.drawText(name, {
    x: width / 2 - nameWidth / 2,
    y: height - 245,
    size: nameSize,
    font: bold,
    color: green,
  });
  // Underline
  page.drawLine({
    start: { x: width / 2 - Math.max(nameWidth, 220) / 2 - 10, y: height - 255 },
    end: { x: width / 2 + Math.max(nameWidth, 220) / 2 + 10, y: height - 255 },
    thickness: 1,
    color: muted,
  });

  // Completion sentence
  page.drawText(L.completion, {
    x: width / 2 - regular.widthOfTextAtSize(L.completion, 12) / 2,
    y: height - 285,
    size: 12,
    font: regular,
    color: muted,
  });

  // Course title
  const courseSize = 20;
  const courseWidth = bold.widthOfTextAtSize(f.courseTitle, courseSize);
  page.drawText(f.courseTitle, {
    x: width / 2 - courseWidth / 2,
    y: height - 320,
    size: courseSize,
    font: bold,
    color: ink,
  });

  // Meta row
  const metaY = 170;
  const metaBoxes: Array<{ label: string; value: string }> = [
    { label: L.issued, value: formatDate(f.issuedAt, f.language) },
    { label: L.number, value: f.certificateNumber },
  ];
  if (typeof f.hours === "number" && f.hours > 0) {
    metaBoxes.splice(1, 0, {
      label: L.hours,
      value: `${f.hours} ${L.hoursUnit}`,
    });
  }
  const boxWidth = (width - pad * 4) / metaBoxes.length;
  metaBoxes.forEach((box, i) => {
    const x = pad * 2 + i * boxWidth;
    page.drawText(box.label, {
      x: x + 4,
      y: metaY + 20,
      size: 9,
      font: regular,
      color: muted,
    });
    page.drawText(box.value, {
      x: x + 4,
      y: metaY,
      size: 13,
      font: bold,
      color: ink,
    });
  });

  // Signatory
  const sigX = width - 250;
  const sigY = 90;
  page.drawLine({
    start: { x: sigX, y: sigY + 18 },
    end: { x: sigX + 180, y: sigY + 18 },
    thickness: 1,
    color: muted,
  });
  page.drawText(f.signatoryName || f.institutionName, {
    x: sigX,
    y: sigY,
    size: 11,
    font: bold,
    color: ink,
  });
  page.drawText(L.signature, {
    x: sigX,
    y: sigY - 14,
    size: 8,
    font: regular,
    color: muted,
  });

  // Verification block
  page.drawText(L.verifyHint, {
    x: pad * 2,
    y: 90,
    size: 8,
    font: regular,
    color: muted,
  });
  page.drawText(f.verificationUrl, {
    x: pad * 2,
    y: 78,
    size: 9,
    font: regular,
    color: green,
  });
  page.drawText(`${L.verify}: ${f.verificationCode}`, {
    x: pad * 2,
    y: 64,
    size: 9,
    font: bold,
    color: ink,
  });

  // Watermark diagonal
  page.drawText(f.institutionName, {
    x: width / 2 - 200,
    y: height / 2 - 30,
    size: 70,
    font: bold,
    color: rgb(0.95, 0.97, 0.96),
    rotate: degrees(-20),
  });

  return await doc.save();
}
