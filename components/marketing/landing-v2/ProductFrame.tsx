import Image from "next/image";

type ProductFrameProps = {
  src: string;
  mobileSrc?: string;
  alt: string;
  priority?: boolean;
  className?: string;
  position?: string;
};

export function ProductFrame({
  src,
  mobileSrc,
  alt,
  priority = false,
  className = "",
  position = "object-center",
}: ProductFrameProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border border-white/14 bg-[#090b0a] p-1.5 shadow-[0_28px_80px_rgba(0,0,0,.42)] ${className}`}
    >
      <picture className="relative block aspect-[5/3] overflow-hidden rounded-[17px]">
        <source media="(max-width: 639px)" srcSet={mobileSrc ?? src} />
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 639px) 92vw, (max-width: 1023px) 78vw, 54vw"
          className={`object-cover ${position}`}
        />
      </picture>
    </div>
  );
}
