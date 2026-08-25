const b = Buffer.from("<html><head>");
const arr = new Uint8Array(b);
const str = Array.from(arr).map(x => String.fromCharCode(x)).join('');
console.log("Includes <html?", str.includes("<html"));
