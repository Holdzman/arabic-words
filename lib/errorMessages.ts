import type { GenerationErrorCode } from "./types";

export function errorMessage(code: GenerationErrorCode, upstreamMessage?: string): string {
  switch (code) {
    case "missing_api_key":
      return "Добавьте свой Anthropic API-ключ в настройках, чтобы генерировать предложения.";
    case "invalid_api_key":
      return "Похоже, API-ключ неверный. Проверьте его в настройках.";
    case "forbidden":
      return "У вашего ключа нет доступа к этой модели. Проверьте план в Anthropic Console.";
    case "rate_limited":
      return "Слишком много запросов подряд. Попробуйте ещё раз через пару секунд.";
    case "server_overloaded":
      return "Сервис Anthropic временно недоступен. Попробуйте позже.";
    case "bad_request":
      return `Ошибка запроса: ${upstreamMessage ?? "неизвестная причина"}`;
    case "network_error":
      return "Проблема с сетью. Проверьте подключение к интернету.";
    case "refusal":
      return "ИИ отказался сгенерировать это предложение.";
    case "truncated":
      return "Ответ оказался обрезан. Попробуйте ещё раз.";
    case "malformed_response":
      return "Не удалось разобрать ответ. Попробуйте ещё раз.";
    case "unknown":
    default:
      return "Неизвестная ошибка. Попробуйте ещё раз.";
  }
}
