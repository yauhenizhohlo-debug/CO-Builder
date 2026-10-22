import assert from "node:assert/strict";
import test from "node:test";
import { assertProposalPdfPages, PROPOSAL_PDF_PAGE_COUNT } from "./download-proposal-pdf.ts";

test("full proposal PDF contract requires exactly three pages", () => {
  const pages = [{}, {}, {}] as HTMLElement[];
  assert.equal(PROPOSAL_PDF_PAGE_COUNT, 3);
  assert.doesNotThrow(() => assertProposalPdfPages(pages));
  assert.throws(() => assertProposalPdfPages(pages.slice(0, 2)), /PROPOSAL_PAGES_NOT_READY/);
  assert.throws(() => assertProposalPdfPages([...pages, {} as HTMLElement]), /PROPOSAL_PAGES_NOT_READY/);
});
