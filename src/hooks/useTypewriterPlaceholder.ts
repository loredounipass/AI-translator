import React from "react";

export const useTypewriterPlaceholder = (text: string): string => {
  const PLACEHOLDER_MESSAGES = React.useMemo(() => ["Start typing..", "Or use voice mode"], []);
  const [placeholder, setPlaceholder] = React.useState("");

  React.useEffect(() => {
    if (text) return;
    let timer: number | null = null;
    let msgIndex = 0;
    let charIndex = 0;

    const typeNext = () => {
      const currentMsg = PLACEHOLDER_MESSAGES[msgIndex];
      charIndex++;
      if (charIndex > currentMsg.length) {
        timer = window.setTimeout(() => {
          setPlaceholder("");
          charIndex = 0;
          msgIndex = (msgIndex + 1) % PLACEHOLDER_MESSAGES.length;
          typeNext();
        }, 3000);
        return;
      }
      setPlaceholder(currentMsg.slice(0, charIndex));
      timer = window.setTimeout(typeNext, 80);
    };
    typeNext();
    return () => { if (timer !== null) window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text ? 'filled' : 'empty']);

  return placeholder;
};
