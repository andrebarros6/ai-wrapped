import { cardFontsClass } from "../card-fonts";

export default function Layout({ children }: LayoutProps<"/story">) {
  return <div className={cardFontsClass}>{children}</div>;
}
