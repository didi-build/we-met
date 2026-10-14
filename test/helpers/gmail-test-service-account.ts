const PEM_PRIVATE_BEGIN = ["-----BEGIN", "PRIVATE", "KEY-----"].join(" ");
const PEM_PRIVATE_END = ["-----END", "PRIVATE", "KEY-----"].join(" ");

export async function generateTestServiceAccount(): Promise<{
  clientEmail: string;
  privateKeyPem: string;
  json: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const bytes = new Uint8Array(pkcs8);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const body = btoa(binary);
  const lines = [PEM_PRIVATE_BEGIN];
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.slice(i, i + 64));
  }
  lines.push(PEM_PRIVATE_END);
  const privateKeyPem = lines.join("\n");
  const clientEmail = "svc@test-project.iam.gserviceaccount.com";
  const json = JSON.stringify({
    client_email: clientEmail,
    private_key: privateKeyPem,
  });
  return { clientEmail, privateKeyPem, json };
}
