import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  INVALID_REQUEST: "リクエスト内容を確認してください。",
  UNAUTHORIZED: "ログインが必要です。",
  PROVIDER_TIMEOUT: "市場データの取得に時間がかかっています。",
  PROVIDER_ERROR: "市場データの取得に失敗しました。",
  NOT_FOUND: "対象のデータが見つかりませんでした。",
  RATE_LIMITED: "しばらく時間をおいてから再度お試しください。",
  INTERNAL_ERROR: "予期しないエラーが発生しました。",
};

const RETRYABLE: Record<ApiErrorCode, boolean> = {
  INVALID_REQUEST: false,
  UNAUTHORIZED: false,
  PROVIDER_TIMEOUT: true,
  PROVIDER_ERROR: true,
  NOT_FOUND: false,
  RATE_LIMITED: true,
  INTERNAL_ERROR: false,
};

const STATUS: Record<ApiErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  PROVIDER_TIMEOUT: 504,
  PROVIDER_ERROR: 502,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/** 内部スタックトレースを露出させず、クライアントへ一貫したエラー形式を返す（設計書24.9）。 */
export function apiError(code: ApiErrorCode, message?: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message: message ?? DEFAULT_MESSAGE[code],
        retryable: RETRYABLE[code],
        requestId: crypto.randomUUID(),
      },
    },
    { status: STATUS[code] }
  );
}
