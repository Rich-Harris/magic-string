const toString = Object.prototype.toString

export default function isObject(thing: unknown): thing is Record<string, any> {
  return toString.call(thing) === '[object Object]'
}
