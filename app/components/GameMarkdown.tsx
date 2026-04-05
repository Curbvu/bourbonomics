import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
};

export default function GameMarkdown({ content }: Props) {
  return (
    <article className="game-markdown max-w-none text-amber-950 dark:text-amber-50">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
