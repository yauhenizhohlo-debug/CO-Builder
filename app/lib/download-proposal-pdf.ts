const PDF_WIDTH_PX = 794;
const PDF_HEIGHT_PX = 1123;

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }
    await image.decode?.().catch(() => undefined);
  }));
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function decodeCapture(jpegDataUrl: string) {
  const image = new Image();
  image.src = jpegDataUrl;
  await image.decode();
  return image;
}

async function savePageTwoDiagnostic(image: HTMLImageElement) {
  if (process.env.NODE_ENV !== "development") return;
  if (!new URLSearchParams(window.location.search).has("pdfCaptureDebug")) return;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF_CAPTURE_DIAGNOSTIC_CANVAS_UNAVAILABLE");
  context.drawImage(image, 0, 0);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `proposal-page-2-capture-${Date.now()}.png`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadProposalPdf(root: HTMLElement, filename: string) {
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"));
  if (pages.length !== 3) throw new Error("PROPOSAL_PAGES_NOT_READY");

  await waitForImages(root);
  await nextPaint();

  const [{ toJpeg }, { jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  for (const [index, page] of pages.entries()) {
    const image = await toJpeg(page, {
      width: PDF_WIDTH_PX,
      height: PDF_HEIGHT_PX,
      pixelRatio: 2,
      quality: 0.96,
      cacheBust: true,
      backgroundColor: index === 2 ? "#151310" : "#f4f0e8",
      style: {
        width: `${PDF_WIDTH_PX}px`,
        height: `${PDF_HEIGHT_PX}px`,
        minHeight: `${PDF_HEIGHT_PX}px`,
        transform: "none",
        boxShadow: "none",
      },
    });

    const rawCaptureDiagnostic = process.env.NODE_ENV === "development"
      && new URLSearchParams(window.location.search).has("pdfCaptureRaw");
    const decodedCapture = rawCaptureDiagnostic ? null : await decodeCapture(image);
    if (index === 1 && decodedCapture) await savePageTwoDiagnostic(decodedCapture);

    if (index > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(image, "JPEG", 0, 0, 210, 297, undefined, "FAST");
  }

  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return blob;
}
