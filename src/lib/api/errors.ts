import { NextResponse } from "next/server";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

export function apiError(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, fieldErrors } }, { status });
}
