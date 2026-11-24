import { cardFontsClass } from "../card-fonts";

export default function Layout({ children }: LayoutProps<"/s">) {
  return <div className={cardFontsClass}>{children}</div>;
}
