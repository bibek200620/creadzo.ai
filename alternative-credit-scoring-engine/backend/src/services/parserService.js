import pdfParse from "pdf-parse";
import { parseString } from "@fast-csv/parse";

const SALARY_KEYWORDS = ["SALARY", "PAYROLL", "WAGES", "SAL", "CREDIT SALARY"];
const EMI_KEYWORDS = ["EMI", "LOAN EMI", "AUTO DEBIT EMI", "NACH EMI", "ECS EMI"];
const UTILITY_KEYWORDS = ["BESCOM", "WATER", "GAS", "RECHARGE", "ELECTRICITY", "UTILITY", "BBMP"];

const CATEGORY_RULES = [
  { category: "Rent", keywords: ["RENT", "LANDLORD", "HOUSE RENT", "LEASE"] },
  { category: "Food", keywords: ["FOOD", "SWIGGY", "ZOMATO", "RESTAURANT", "CAFE", "GROCERY", "BIGBASKET", "KIRANA"] },
  { category: "Bills", keywords: ["BESCOM", "WATER", "GAS", "RECHARGE", "ELECTRICITY", "BILL", "POSTPAID", "WIFI", "BROADBAND", "UTILITY"] },
  { category: "EMI", keywords: ["EMI", "LOAN", "NACH", "ECS", "AUTO DEBIT"] },
  { category: "Transport", keywords: ["UBER", "OLA", "METRO", "FUEL", "PETROL", "DIESEL", "BUS", "TRAIN"] },
  { category: "Shopping", keywords: ["AMAZON", "FLIPKART", "MYNTRA", "SHOPPING", "MART"] },
  { category: "Healthcare", keywords: ["HOSPITAL", "PHARMA", "MEDICAL", "CLINIC", "LAB"] },
  { category: "Cash Withdrawal", keywords: ["ATM", "CASH WD", "CASH WITHDRAWAL"] },
  { category: "Entertainment", keywords: ["NETFLIX", "PRIME", "HOTSTAR", "BOOKMYSHOW", "MOVIE"] },
  { category: "Transfer", keywords: ["UPI", "IMPS", "NEFT", "RTGS", "TRANSFER"] },
];

const CSV_HEADERS = {
  date: ["date", "transactiondate", "transaction date", "txn date", "posting date", "value date"],
  description: ["description", "narration", "remarks", "particulars", "details"],
  credit: ["credit", "deposit", "cr"],
  debit: ["debit", "withdrawal", "dr"],
  amount: ["amount", "txn amount", "transaction amount"],
  balance: ["balance", "running balance", "available balance"],
};

export async function parseUploadedStatement(file) {
  const originalName = file.originalname || "statement";
  const extension = originalName.split(".").pop()?.toLowerCase();

  if (extension !== "pdf" && extension !== "csv") {
    throw new Error("Only PDF and CSV statements are supported");
  }

  if (extension === "pdf") {
    const transactions = await parsePdfBuffer(file.buffer);
    return {
      fileType: "pdf",
      transactions,
    };
  }

  const transactions = await parseCsvBuffer(file.buffer);
  return {
    fileType: "csv",
    transactions,
  };
}

async function parsePdfBuffer(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text || "";
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const extracted = [];

  for (const line of lines) {
    const tx = parsePdfLine(line);
    if (!tx) continue;

    const enriched = enrichTransaction(tx);
    if (enriched) {
      extracted.push(enriched);
    }
  }

  return extracted.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function parsePdfLine(line) {
  const dateMatch = line.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.*)$/);
  if (!dateMatch) return null;

  const rawDate = dateMatch[1];
  const rest = dateMatch[2];
  const parsedDate = parseDate(rawDate);
  if (!parsedDate) return null;

  const firstNumberIndex = rest.search(/-?\d[\d,]*(?:\.\d+)?/);
  if (firstNumberIndex === -1) return null;

  const description = rest.slice(0, firstNumberIndex).trim();
  const numericSegment = rest.slice(firstNumberIndex);
  const numbers = (numericSegment.match(/-?\d[\d,]*(?:\.\d+)?/g) || [])
    .map(toNumber)
    .filter((n) => Number.isFinite(n));

  if (!description || numbers.length < 2) return null;

  let amount = 0;
  let type = "debit";
  let balance = numbers[numbers.length - 1];

  if (numbers.length >= 3) {
    const debitCandidate = numbers[numbers.length - 3];
    const creditCandidate = numbers[numbers.length - 2];

    if ((creditCandidate || 0) > (debitCandidate || 0)) {
      amount = Math.abs(creditCandidate);
      type = "credit";
    } else {
      amount = Math.abs(debitCandidate);
      type = "debit";
    }
  } else {
    amount = Math.abs(numbers[0]);
    const upperLine = line.toUpperCase();
    type = upperLine.includes(" CR") || upperLine.includes("CREDIT") ? "credit" : "debit";
  }

  if (!amount || amount <= 0) return null;

  return {
    date: parsedDate,
    description,
    amount,
    type,
    balance: Number.isFinite(balance) ? balance : null,
  };
}

async function parseCsvBuffer(buffer) {
  const csvText = buffer.toString("utf8");
  const rows = await new Promise((resolve, reject) => {
    const parsedRows = [];

    parseString(csvText, {
      headers: true,
      ignoreEmpty: true,
      trim: true,
    })
      .on("error", reject)
      .on("data", (row) => parsedRows.push(row))
      .on("end", () => resolve(parsedRows));
  });

  const transactions = [];

  for (const row of rows) {
    const dateValue = getField(row, CSV_HEADERS.date);
    const descriptionValue = getField(row, CSV_HEADERS.description) || "Unknown Transaction";

    const parsedDate = parseDate(dateValue);
    if (!parsedDate) continue;

    const creditValue = toNumber(getField(row, CSV_HEADERS.credit));
    const debitValue = toNumber(getField(row, CSV_HEADERS.debit));
    const amountValue = toNumber(getField(row, CSV_HEADERS.amount));
    const balanceValue = toNumber(getField(row, CSV_HEADERS.balance));

    let amount = 0;
    let type = "debit";

    if (creditValue > 0 || debitValue > 0) {
      if (creditValue > 0) {
        amount = creditValue;
        type = "credit";
      } else {
        amount = debitValue;
        type = "debit";
      }
    } else if (amountValue !== 0) {
      amount = Math.abs(amountValue);
      type = amountValue >= 0 ? "credit" : "debit";
    }

    if (!amount || amount <= 0) continue;

    const tx = enrichTransaction({
      date: parsedDate,
      description: descriptionValue,
      amount,
      type,
      balance: Number.isFinite(balanceValue) ? balanceValue : null,
    });

    if (tx) transactions.push(tx);
  }

  return transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function enrichTransaction(transaction) {
  if (!transaction?.description || !transaction?.date || !transaction?.amount) {
    return null;
  }

  const normalizedDescription = sanitizeDescription(transaction.description);
  const flags = detectFlags(normalizedDescription);
  const category = categorizeTransaction(normalizedDescription, transaction.type, flags);

  return {
    date: transaction.date,
    description: normalizedDescription,
    amount: round2(transaction.amount),
    type: transaction.type,
    balance: Number.isFinite(transaction.balance) ? round2(transaction.balance) : null,
    category,
    flags,
  };
}

function sanitizeDescription(description = "") {
  return String(description).replace(/\s+/g, " ").trim();
}

function detectFlags(description) {
  const upper = description.toUpperCase();

  return {
    isSalary: containsKeyword(upper, SALARY_KEYWORDS),
    isEmi: containsKeyword(upper, EMI_KEYWORDS),
    isUtility: containsKeyword(upper, UTILITY_KEYWORDS),
  };
}

function categorizeTransaction(description, type, flags) {
  if (type === "credit") {
    return flags.isSalary ? "Income" : "Credit";
  }

  if (flags.isEmi) return "EMI";
  if (flags.isUtility) return "Bills";

  const upper = description.toUpperCase();

  for (const rule of CATEGORY_RULES) {
    if (containsKeyword(upper, rule.keywords)) {
      return rule.category;
    }
  }

  return "Other";
}

function containsKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getField(row, candidateKeys) {
  const entries = Object.entries(row || {});

  for (const [key, value] of entries) {
    const normalizedKey = key.toLowerCase().replace(/[_.-]/g, " ").trim();
    if (candidateKeys.includes(normalizedKey)) {
      return value;
    }
  }

  return null;
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();

  const ddMmYyyy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (ddMmYyyy) {
    const day = Number(ddMmYyyy[1]);
    const month = Number(ddMmYyyy[2]) - 1;
    const year = Number(ddMmYyyy[3].length === 2 ? `20${ddMmYyyy[3]}` : ddMmYyyy[3]);

    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const isoDate = new Date(raw);
  if (!Number.isNaN(isoDate.getTime())) return isoDate;

  return null;
}

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[,₹\s]/g, "").trim();
  if (!cleaned) return 0;

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
