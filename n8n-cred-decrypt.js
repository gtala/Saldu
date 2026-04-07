/**
 * Prueba de desencriptado al estilo n8n (CryptoJS AES con passphrase).
 * Uso: node n8n-cred-decrypt.js <archivo_con_ciphertext_una_linea> <encryptionKey>
 */
const fs = require("fs");
const CryptoJS = require("crypto-js");

const [,, file, key] = process.argv;
if (!file || !key) {
  console.error("Uso: node n8n-cred-decrypt.js <file> <key>");
  process.exit(1);
}
const cipher = fs.readFileSync(file, "utf8").trim();
const plain = CryptoJS.AES.decrypt(cipher, key).toString(CryptoJS.enc.Utf8);
if (!plain) {
  console.error("Fallo desencriptado (clave o formato incorrecto)");
  process.exit(2);
}
console.log(plain);
