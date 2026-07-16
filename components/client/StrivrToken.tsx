import Image from "next/image";

type StrivrTokenProps = {
  size?: number;
  className?: string;
  alt?: string;
};

/** The canonical STRYVR currency mark used anywhere a balance is shown. */
export default function StrivrToken({
  size = 18,
  className = "",
  alt = "",
}: StrivrTokenProps) {
  return (
    <span
      aria-hidden={alt ? undefined : true}
      className={`relative inline-block shrink-0 align-[-0.16em] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/images/currency/stryvr-token.png"
        alt={alt}
        fill
        sizes={`${size}px`}
        className="object-contain"
      />
    </span>
  );
}
