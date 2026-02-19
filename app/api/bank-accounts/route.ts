import { NextRequest, NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/server/auth";
import { jsonError, parseOptionalString, safeErrorMessage } from "@/lib/server/api";
import { bankAccountsCollection, maskAccountNumber } from "@/lib/server/store";

type CreateBankAccountBody = {
  bankName?: unknown;
  accountNumber?: unknown;
  ifsc?: unknown;
  accountType?: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const uid = await requireUserId(req);
    const snapshot = await bankAccountsCollection(uid)
      .orderBy("createdAtMs", "desc")
      .get();

    const accounts = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        bankName: typeof data.bankName === "string" ? data.bankName : "",
        maskedAccount: typeof data.maskedAccount === "string" ? data.maskedAccount : "",
        ifsc: typeof data.ifsc === "string" ? data.ifsc : "",
        accountType: typeof data.accountType === "string" ? data.accountType : "SAVINGS",
        status: typeof data.status === "string" ? data.status : "ACTIVE",
        createdAt: typeof data.createdAtMs === "number" ? new Date(data.createdAtMs).toISOString() : null,
      };
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(error.message, 401);
    return jsonError(safeErrorMessage(error, "Failed to load bank accounts."), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await requireUserId(req);
    const body = (await req.json()) as CreateBankAccountBody;

    const bankName = parseOptionalString(body.bankName);
    const accountNumber = parseOptionalString(body.accountNumber);
    const ifsc = parseOptionalString(body.ifsc).toUpperCase();
    const accountType = parseOptionalString(body.accountType) || "SAVINGS";

    if (!bankName || bankName.length < 2) return jsonError("Bank name is required.", 400);
    if (accountNumber.replace(/\D/g, "").length < 6) return jsonError("Valid account number is required.", 400);
    if (!ifsc || ifsc.length < 6) return jsonError("Valid IFSC code is required.", 400);

    const nowMs = Date.now();
    const record = {
      bankName,
      maskedAccount: maskAccountNumber(accountNumber),
      ifsc,
      accountType,
      status: "ACTIVE",
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    const docRef = bankAccountsCollection(uid).doc();
    await docRef.set(record);

    return NextResponse.json({
      account: {
        id: docRef.id,
        ...record,
        createdAt: new Date(nowMs).toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(error.message, 401);
    return jsonError(safeErrorMessage(error, "Failed to add bank account."), 500);
  }
}
