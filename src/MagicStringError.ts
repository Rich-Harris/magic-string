/**
 * The single error type thrown by MagicString.
 *
 * Every message is prefixed with `[MagicString]` so its source is obvious at a
 * glance, and is kept short and consistent in tone.
 */
export default class MagicStringError extends Error {
  override name = 'MagicStringError'

  constructor(message: string, options?: ErrorOptions) {
    super(`[MagicString] ${message}`, options)
  }
}
