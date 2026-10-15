// Bounded arithmetic parser: no eval, Function, or execution of user input.
export function calculate(expression: string): number {
  if (typeof expression !== 'string' || expression.length > 1000) throw new Error('Ekspresi terlalu panjang.');
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+*/-]/g) ?? [];
  if (tokens.join('') !== expression.replace(/\s/g, '')) throw new Error('Ekspresi tidak valid.');
  let cursor = 0;
  const atom = (): number => {
    const token = tokens[cursor++];
    if (token === '-') return -atom();
    if (token === '(') {
      const value = sum();
      if (tokens[cursor++] !== ')') throw new Error('Kurung tidak lengkap.');
      return value;
    }
    if (!token || !/^\d/.test(token)) throw new Error('Angka tidak ditemukan.');
    return Number(token);
  };
  const product = (): number => {
    let value = atom();
    while (tokens[cursor] === '*' || tokens[cursor] === '/') {
      const operator = tokens[cursor++];
      const other = atom();
      value = operator === '*' ? value * other : value / other;
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const operator = tokens[cursor++];
      const other = product();
      value = operator === '+' ? value + other : value - other;
    }
    return value;
  };
  const result = sum();
  if (cursor !== tokens.length || !Number.isFinite(result)) throw new Error('Ekspresi tidak dapat dihitung.');
  return result;
}
export type Logic = { op: 'var'; name: string } | { op: 'not'; item: Logic } |
  { op: 'and' | 'or' | 'implies'; left: Logic; right: Logic };
export const variable = (name: string): Logic => ({ op: 'var', name });
export const not = (item: Logic): Logic => ({ op: 'not', item });
export const implies = (left: Logic, right: Logic): Logic => ({ op: 'implies', left, right });
function evaluate(node: Logic, values: Record<string, boolean>): boolean {
  if (node.op === 'var') return values[node.name];
  if (node.op === 'not') return !evaluate(node.item, values);
  if (node.op === 'and') return evaluate(node.left, values) && evaluate(node.right, values);
  if (node.op === 'or') return evaluate(node.left, values) || evaluate(node.right, values);
  return !evaluate(node.left, values) || evaluate(node.right, values);
}
export function entails(premises: Logic[], conclusions: Logic[]): boolean[] {
  const names = new Set<string>();
  let visited = 0;
  const visit = (node: Logic, depth = 0) => {
    if (!node || ++visited > 256 || depth > 32) throw new Error('Model logika melampaui batas.');
    if (!['var', 'not', 'and', 'or', 'implies'].includes(node.op)) throw new Error('Operator logika tidak valid.');
    if (node.op === 'var') names.add(node.name);
    else if (node.op === 'not') visit(node.item, depth + 1);
    else { visit(node.left, depth + 1); visit(node.right, depth + 1); }
  };
  [...premises, ...conclusions].forEach((node) => visit(node));
  if (names.size > 12) throw new Error('Terlalu banyak variabel logika.');
  const keys = [...names];
  const worlds = Array.from({ length: 2 ** keys.length }, (_, mask) =>
    Object.fromEntries(keys.map((key, index) => [key, Boolean(mask & (1 << index))])));
  const possible = worlds.filter((world) => premises.every((node) => evaluate(node, world)));
  if (!possible.length) throw new Error('Premis tidak konsisten.');
  return conclusions.map((node) => possible.every((world) => evaluate(node, world)));
}
