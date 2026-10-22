const PDF_WIDTH_PX = 794;
const PDF_HEIGHT_PX = 1123;
export const PROPOSAL_PDF_PAGE_COUNT = 3;

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

export function assertProposalPdfPages(pages: HTMLElement[]) {
  if (pages.length !== PROPOSAL_PDF_PAGE_COUNT) throw new Error("PROPOSAL_PAGES_NOT_READY");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function canShareProposalPdf(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "application/pdf" });
  return (window.matchMedia?.("(pointer: coarse)").matches ?? false)
    && typeof navigator.share === "function"
    && typeof navigator.canShare === "function"
    && navigator.canShare({ files: [file] });
}

export async function shareProposalPdf(blob: Blob, filename: string) {
  if (!canShareProposalPdf(blob, filename)) throw new Error("PROPOSAL_PDF_SHARE_UNAVAILABLE");
  const file = new File([blob], filename, { type: "application/pdf" });
  await navigator.share({ files: [file], title: filename });
}

export async function downloadProposalPdf(root: HTMLElement, filename: string) {
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"));
  assertProposalPdfPages(pages);

  await document.fonts.ready;
  await waitForImages(root);
  await nextPaint();

  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  for (const [index, page] of pages.entries()) {
    const originalStyle = page.style.cssText;
    Object.assign(page.style, {
      boxSizing: "border-box",
      position: "fixed",
      inset: "0 auto auto 0",
      zIndex: "2147483647",
      width: `${PDF_WIDTH_PX}px`,
      minWidth: `${PDF_WIDTH_PX}px`,
      maxWidth: `${PDF_WIDTH_PX}px`,
      height: `${PDF_HEIGHT_PX}px`,
      minHeight: `${PDF_HEIGHT_PX}px`,
      maxHeight: `${PDF_HEIGHT_PX}px`,
      margin: "0",
      padding: "56px",
      overflow: "hidden",
      transform: "none",
      boxShadow: "none",
      pointerEvents: "none",
    });

    let image: string;
    try {
      await nextPaint();
      image = await toJpeg(page, {
        width: PDF_WIDTH_PX,
        height: PDF_HEIGHT_PX,
        canvasWidth: PDF_WIDTH_PX * 2,
        canvasHeight: PDF_HEIGHT_PX * 2,
        pixelRatio: 1,
        quality: 0.96,
        cacheBust: true,
        backgroundColor: index === 2 ? "#151310" : "#f4f0e8",
      });
    } finally {
      page.style.cssText = originalStyle;
    }

    if (index > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(image, "JPEG", 0, 0, 210, 297, undefined, "FAST");
  }

  if (pdf.getNumberOfPages() !== PROPOSAL_PDF_PAGE_COUNT) throw new Error("PROPOSAL_PDF_PAGE_COUNT_MISMATCH");
  const blob = pdf.output("blob");
  triggerDownload(blob, filename);
  return { blob, pageCount: pdf.getNumberOfPages() };
}
