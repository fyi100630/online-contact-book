// 把文字裡的網址變成連結。用 React 元素組合，不使用 innerHTML，杜絕 XSS。
const URL_RE = /(https?:\/\/[^\s<>"'，。！？（）「」『』、]+)/g;

export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const clean = part.replace(/[.,;:!?)]+$/, '');
          const rest = part.slice(clean.length);
          return (
            <span key={i}>
              <a href={clean} target="_blank" rel="noopener noreferrer nofollow">
                {clean}
              </a>
              {rest}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
