import type { AuthErrorCode } from "./types";

export function authErrorMessage(code: AuthErrorCode, upstreamMessage?: string): string {
  switch (code) {
    case "not_authenticated":
      return "Сессия истекла. Войдите снова.";
    case "invalid_credentials":
      return "Неверное имя пользователя или пароль.";
    case "username_taken":
      return "Это имя пользователя уже занято.";
    case "weak_password":
      return "Пароль слишком короткий — минимум 8 символов.";
    case "invalid_username":
      return "Имя пользователя: 3–32 символа, латиница/цифры/._-.";
    case "invalid_signup_code":
      return "Неверный код приглашения.";
    case "bad_request":
      return `Ошибка запроса: ${upstreamMessage ?? "неизвестная причина"}`;
    case "unknown":
    default:
      return "Неизвестная ошибка. Попробуйте ещё раз.";
  }
}
