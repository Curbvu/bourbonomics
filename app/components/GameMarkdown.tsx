import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
};

export default function GameMarkdown({ content }: Props) {
  return (
    <article className="game-markdown max-w-none text-slate-900 dark:text-slate-100">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
