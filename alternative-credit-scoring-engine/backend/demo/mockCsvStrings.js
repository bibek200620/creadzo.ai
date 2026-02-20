import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readCsv(fileName) {
  return fs.readFileSync(path.join(__dirname, "statements", fileName), "utf8");
}

export const mockCsvStrings = {
  gigWorker: readCsv("gig_worker.csv"),
  salariedWithEmi: readCsv("salaried_emi.csv"),
  volatileCashflow: readCsv("volatile_cashflow.csv"),
};
