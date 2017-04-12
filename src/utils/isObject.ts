const toString = Object.prototype.toString;

export default function isObject ( thing: any ) {
	return toString.call( thing ) === '[object Object]';
}
