import { createServer } from "node:http";
import { installmentContext, mortgageContext,standardMortgageContext } from "./fixtures/proposal-contexts.mjs";

const port = Number(process.env.MOCK_INVENTORY_PORT ?? 3101);

createServer((request, response) => {
  const context = request.url?.endsWith(mortgageContext.data.id)
    ? mortgageContext
    : request.url?.endsWith(standardMortgageContext.data.id)
      ? standardMortgageContext
    : request.url?.endsWith(installmentContext.data.id)
      ? installmentContext
      : null;

  response.writeHead(context ? 200 : 404, { "content-type": "application/json" });
  response.end(JSON.stringify(context ?? { error: "NOT_FOUND" }));
}).listen(port, "127.0.0.1", () => {
  console.log(`Mock Inventory listening on http://127.0.0.1:${port}`);
});
