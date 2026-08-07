/**
 * 称呼替换：把叙述文本中的「你」替换为玩家名字，增强代入感。
 * 规则：单字「你」替换（「你的」→「小明的」）；跳过「你们」「你自己」
 * （复数与反身代词的语感与名字不兼容）。名字为空时原样返回。
 *
 * @param text 原始文本
 * @param name 玩家名字
 * @returns 替换后的文本
 */
export function useName(text: string, name: string): string {
  if (!name) {
    return text;
  }
  return text.replace(/你(?!们|自己)/g, name);
}
