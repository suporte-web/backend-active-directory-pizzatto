import { RDN } from 'ldapjs';

export function patchLdapjsUnescapedDn() {
  const proto: any = (RDN as any)?.prototype;
  if (!proto?.toString) return;

  // idempotente (não patchar 2x)
  if (proto.__unescapedPatched) return;

  const originalToString = proto.toString;

  proto.toString = function (options?: any) {
    // força a gerar DN sem escapes
    return originalToString.apply(this, [
      { ...(options || {}), unescaped: true },
    ]);
  };

  proto.__unescapedPatched = true;
}
