import Image from "next/image";

/**
 * Foto vinda do banco ou de `public/`.
 *
 * Caminho local (`/cozinha.jpeg`) passa pelo next/image, que redimensiona e
 * serve WebP — os originais vão de 60 KB a 3,5 MB, e quase todo convidado abre
 * isso no 4G. URL externa cai no `<img>` cru, porque o otimizador exigiria
 * liberar o domínio em next.config a cada presente novo.
 *
 * Usa `fill`, então o elemento pai precisa ser `relative`.
 */
export function Photo({
  src,
  alt,
  sizes,
  priority,
  objectPosition,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  objectPosition?: string;
}) {
  if (!src.startsWith("/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover"
      style={objectPosition ? { objectPosition } : undefined}
    />
  );
}

/** Presente ainda sem foto — melhor que um buraco branco no meio da grade. */
export function PhotoPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-accent/8">
      <span className="text-4xl opacity-40" aria-hidden>
        🎁
      </span>
    </div>
  );
}
