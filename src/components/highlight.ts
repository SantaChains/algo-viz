export type TokenType = 'kw' | 'str' | 'com' | 'num' | 'plain';

export interface Token {
  text: string;
  type: TokenType;
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'for', 'while', 'if', 'else',
  'of', 'in', 'new', 'break', 'continue', 'class', 'extends', 'export',
  'import', 'from', 'this', 'typeof', 'interface', 'type',
]);

const TOKEN_RE =
  /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

/** 单文件轻量 TS 高亮：整段 tokenize 后按行切分，块注释跨行状态天然正确 */
export function tokenizeLines(source: string): Token[][] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN_RE)) {
    const at = match.index ?? 0;
    if (at > last) tokens.push({ text: source.slice(last, at), type: 'plain' });
    const [raw, com, str, num, word] = match;
    if (com) tokens.push({ text: raw, type: 'com' });
    else if (str) tokens.push({ text: raw, type: 'str' });
    else if (num) tokens.push({ text: raw, type: 'num' });
    else if (word && KEYWORDS.has(word)) tokens.push({ text: raw, type: 'kw' });
    else tokens.push({ text: raw, type: 'plain' });
    last = at + raw.length;
  }
  if (last < source.length) tokens.push({ text: source.slice(last), type: 'plain' });

  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, type: token.type });
    });
  }
  return lines;
}
